[CmdletBinding()]
param(
    [int]$MysqlPort = 3307,
    [int]$ServerPort = 8081,
    [string]$AdminUsername = "admin",
    [string]$AdminPassword = "Admin123!",
    [switch]$StopAfter
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
Add-Type -AssemblyName System.Net.Http

$baseUrl = "http://localhost:$ServerPort"
$httpClient = [System.Net.Http.HttpClient]::new()
$httpClient.Timeout = [TimeSpan]::FromSeconds(15)

function Invoke-ServiceApi {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Path,
        [string]$Token,
        [object]$Body,
        [int[]]$ExpectedStatus = @(200)
    )

    $response = $null
    $request = [System.Net.Http.HttpRequestMessage]::new(
        [System.Net.Http.HttpMethod]::new($Method),
        "$baseUrl$Path"
    )
    if ($Token) {
        $request.Headers.Authorization =
            [System.Net.Http.Headers.AuthenticationHeaderValue]::new("Bearer", $Token)
    }
    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 10 -Compress
        $request.Content = [System.Net.Http.StringContent]::new(
            $json, [System.Text.Encoding]::UTF8, "application/json"
        )
    }

    try {
        $response = $httpClient.SendAsync($request).GetAwaiter().GetResult()
        $status = [int]$response.StatusCode
        $content = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if ($ExpectedStatus -notcontains $status) {
            throw "Expected HTTP $($ExpectedStatus -join '/') for $Method $Path, got $status. Body: $content"
        }
        if ([string]::IsNullOrWhiteSpace($content)) {
            return $null
        }
        return $content | ConvertFrom-Json
    }
    finally {
        $request.Dispose()
        if ($null -ne $response) {
            $response.Dispose()
        }
    }
}

function Assert-True {
    param(
        [Parameter(Mandatory = $true)][bool]$Condition,
        [Parameter(Mandatory = $true)][string]$Message
    )
    if (-not $Condition) {
        throw "Assertion failed: $Message"
    }
}

function Wait-ForApplication {
    $deadline = (Get-Date).AddMinutes(3)
    while ((Get-Date) -lt $deadline) {
        try {
            $health = Invoke-ServiceApi -Method GET -Path "/actuator/health"
            if ($health.status -eq "UP") {
                Write-Host "Application health is UP." -ForegroundColor Green
                return
            }
        }
        catch {
            # Startup failures are reported with container logs after the timeout.
        }
        Start-Sleep -Seconds 2
    }
    docker compose ps
    docker compose logs --tail 100 app
    throw "Application did not become healthy within 3 minutes."
}

function Login {
    param(
        [Parameter(Mandatory = $true)][string]$Username,
        [Parameter(Mandatory = $true)][string]$Password,
        [int[]]$ExpectedStatus = @(200)
    )
    return Invoke-ServiceApi -Method POST -Path "/api/v1/auth/login" -Body @{
        username = $Username
        password = $Password
    } -ExpectedStatus $ExpectedStatus
}

$originalMysqlPort = $env:MYSQL_PORT
$originalServerPort = $env:SERVER_PORT
$env:MYSQL_PORT = "$MysqlPort"
$env:SERVER_PORT = "$ServerPort"

try {
    Write-Host "Building and starting Smart Service..." -ForegroundColor Cyan
    docker compose up -d --build
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose up failed with exit code $LASTEXITCODE."
    }
    Wait-ForApplication

    $suffix = "{0}{1}" -f (Get-Date -Format "MMddHHmmss"), (Get-Random -Minimum 100 -Maximum 999)
    $agentUsername = "agent-$suffix"
    $requesterUsername = "requester-$suffix"
    $agentPassword = "AgentPass123!"
    $requesterPassword = "RequesterPass123!"
    $searchToken = "smoketest$suffix"

    Write-Host "1/8 Authenticating the bootstrap administrator..."
    $adminToken = (Login -Username $AdminUsername -Password $AdminPassword).accessToken
    Assert-True (![string]::IsNullOrWhiteSpace($adminToken)) "administrator login should return an access token"

    Write-Host "2/8 Creating agent and requester accounts..."
    $agent = Invoke-ServiceApi -Method POST -Path "/api/v1/users" -Token $adminToken -Body @{
        username = $agentUsername; password = $agentPassword; roles = @("AGENT")
    } -ExpectedStatus 201
    $requester = Invoke-ServiceApi -Method POST -Path "/api/v1/users" -Token $adminToken -Body @{
        username = $requesterUsername; password = $requesterPassword; roles = @("REQUESTER")
    } -ExpectedStatus 201
    Assert-True ($agent.roles -contains "AGENT") "created agent should have the AGENT role"
    Assert-True ($requester.roles -contains "REQUESTER") "created requester should have the REQUESTER role"
    $agentToken = (Login -Username $agentUsername -Password $agentPassword).accessToken
    $requesterToken = (Login -Username $requesterUsername -Password $requesterPassword).accessToken

    Write-Host "3/8 Verifying role-based user-management protection..."
    $null = Invoke-ServiceApi -Method GET -Path "/api/v1/users" -Token $requesterToken -ExpectedStatus 403

    Write-Host "4/8 Creating tickets and verifying requester isolation..."
    $requesterTicket = Invoke-ServiceApi -Method POST -Path "/api/v1/tickets" -Token $requesterToken -Body @{
        title = "Smoke test VPN issue $suffix"
        description = "End-to-end verification ticket created by the requester."
        priority = "P1"
    } -ExpectedStatus 201
    $adminTicket = Invoke-ServiceApi -Method POST -Path "/api/v1/tickets" -Token $adminToken -Body @{
        title = "Administrator-only smoke ticket $suffix"
        description = "This ticket must not be visible to the requester."
        priority = "P3"
    } -ExpectedStatus 201
    $null = Invoke-ServiceApi -Method GET -Path "/api/v1/tickets/$($adminTicket.id)" `
        -Token $requesterToken -ExpectedStatus 404

    Write-Host "5/8 Assigning, transitioning, and commenting on the ticket..."
    $assignedTicket = Invoke-ServiceApi -Method PATCH `
        -Path "/api/v1/tickets/$($requesterTicket.id)/assignee" -Token $adminToken -Body @{
            username = $agentUsername
        }
    Assert-True ($assignedTicket.assigneeUsername -eq $agentUsername) "ticket should be assigned to the new agent"
    $activeTicket = Invoke-ServiceApi -Method PATCH `
        -Path "/api/v1/tickets/$($requesterTicket.id)/status" -Token $agentToken -Body @{
            status = "IN_PROGRESS"
        }
    Assert-True ($activeTicket.status -eq "IN_PROGRESS") "ticket should transition to IN_PROGRESS"
    $comment = Invoke-ServiceApi -Method POST `
        -Path "/api/v1/tickets/$($requesterTicket.id)/comments" -Token $agentToken -Body @{
            content = "Smoke test confirms the agent can investigate this ticket."
        } -ExpectedStatus 201
    Assert-True ($comment.authorUsername -eq $agentUsername) "comment should record the agent as author"

    Write-Host "6/8 Verifying the immutable audit trail..."
    $auditPage = Invoke-ServiceApi -Method GET `
        -Path "/api/v1/tickets/$($requesterTicket.id)/audit-events?size=20" -Token $agentToken
    $eventTypes = @($auditPage.content | ForEach-Object { $_.eventType })
    foreach ($expectedType in @("TICKET_CREATED", "ASSIGNEE_CHANGED", "STATUS_CHANGED", "COMMENT_ADDED")) {
        Assert-True ($eventTypes -contains $expectedType) "audit trail should contain $expectedType"
    }

    Write-Host "7/8 Publishing and finding a knowledge article..."
    $article = Invoke-ServiceApi -Method POST -Path "/api/v1/knowledge/articles" -Token $agentToken -Body @{
        title = "VPN recovery $searchToken"
        summary = "A uniquely searchable article created by the smoke test."
        content = "Use gateway diagnostics and the token $searchToken to verify full-text retrieval."
        category = "Network"
    } -ExpectedStatus 201
    $published = Invoke-ServiceApi -Method POST `
        -Path "/api/v1/knowledge/articles/$($article.id)/publish" -Token $agentToken
    Assert-True ($published.status -eq "PUBLISHED") "article should be published"
    $encodedQuery = [Uri]::EscapeDataString($searchToken)
    $searchPage = Invoke-ServiceApi -Method GET `
        -Path "/api/v1/knowledge/articles/search?query=$encodedQuery" -Token $requesterToken
    $matchingIds = @($searchPage.content | ForEach-Object { [long]$_.id })
    Assert-True ($matchingIds -contains [long]$article.id) "full-text search should find the published article"

    Write-Host "8/8 Disabling the requester and rejecting a new login..."
    $disabled = Invoke-ServiceApi -Method PATCH -Path "/api/v1/users/$($requester.id)/enabled" `
        -Token $adminToken -Body @{ enabled = $false }
    Assert-True (-not $disabled.enabled) "requester should be disabled"
    $null = Login -Username $requesterUsername -Password $requesterPassword -ExpectedStatus 401

    Write-Host ""
    Write-Host "SMART SERVICE END-TO-END SMOKE TEST PASSED" -ForegroundColor Green
    Write-Host "Ticket: $($requesterTicket.id) | Article: $($article.id) | Agent: $agentUsername"
}
finally {
    $httpClient.Dispose()
    if ($StopAfter) {
        Write-Host "Stopping project containers (database volume is preserved)..."
        docker compose stop
    }
    $env:MYSQL_PORT = $originalMysqlPort
    $env:SERVER_PORT = $originalServerPort
}
