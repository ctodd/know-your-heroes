async function updateLeaderboard() {
    try {
        let docClient;
        
        // Check if user is logged in
        const user = await getCurrentUser();
        if (user) {
            console.log("User is logged in, refreshing credentials");
            // Refresh credentials if user is logged in
            await refreshCredentials();
            docClient = new AWS.DynamoDB.DocumentClient({ region: awsConfig.tableGamesRegion });
        } else {
            console.log("User is not logged in, using unauthenticated access");
            // Use unauthenticated access for non-logged in users
            AWS.config.region = awsConfig.region;
            AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                IdentityPoolId: awsConfig.identityPoolId
            });
            
            // Explicitly get the credentials
            await new Promise((resolve, reject) => {
                AWS.config.credentials.get((err) => {
                    if (err) {
                        console.error("Error getting unauthenticated credentials:", err);
                        reject(err);
                    } else {
                        console.log("Unauthenticated credentials obtained successfully");
                        resolve();
                    }
                });
            });
            
            docClient = new AWS.DynamoDB.DocumentClient({ region: awsConfig.tableGamesRegion });
        }

        console.log("Attempting to scan DynamoDB table");
        const params = {
            TableName: awsConfig.tableGames,
            ProjectionExpression: "userId, playerName, score",
            Limit: 10
        };
        
        const data = await docClient.scan(params).promise();
        console.log("DynamoDB scan successful, data:", data);
        
        const leaderboardData = data.Items.sort((a, b) => b.score - a.score);

        const leaderboardBody = document.getElementById('leaderboardBody');
        leaderboardBody.innerHTML = '';

        leaderboardData.forEach((entry, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${entry.playerName || entry.userId}</td>
                <td>${entry.score}</td>
            `;
            leaderboardBody.appendChild(row);
        });
        
        console.log("Leaderboard updated successfully");
    } catch (error) {
        console.error('Error updating leaderboard:', error);
        // Display error message to user
        const leaderboardBody = document.getElementById('leaderboardBody');
        leaderboardBody.innerHTML = '<tr><td colspan="3">Error loading leaderboard. Please try again later.</td></tr>';
    }
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', updateLeaderboard);