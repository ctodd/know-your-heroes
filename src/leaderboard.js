let updateLeaderboardTimeout = null;

async function updateLeaderboard() {
    if (updateLeaderboardTimeout) {
        clearTimeout(updateLeaderboardTimeout);
    }

    updateLeaderboardTimeout = setTimeout(async () => {
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

            console.log("Attempting to query DynamoDB table");
            const params = {
                TableName: awsConfig.tableGames,
                IndexName: "ScoreIndex",
                KeyConditionExpression: "scorePartition = :sp",
                ExpressionAttributeValues: {
                    ":sp": "SCORE"
                },
                ProjectionExpression: "userId, playerName, score",
                ScanIndexForward: false,
                Limit: 10
            };
            
            const data = await docClient.query(params).promise();
            console.log("DynamoDB query successful, data:", data);
            
            const leaderboardData = data.Items;

            const leaderboardBody = document.getElementById('leaderboardBody');
            leaderboardBody.innerHTML = '';

            if (leaderboardData && leaderboardData.length > 0) {
                leaderboardData.forEach((entry, index) => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${index + 1}</td>
                        <td>${entry.playerName || entry.userId}</td>
                        <td>${entry.score}</td>
                    `;
                    leaderboardBody.appendChild(row);
                });
            } else {
                leaderboardBody.innerHTML = '<tr><td colspan="3">No scores available yet.</td></tr>';
            }
            
            console.log("Leaderboard updated successfully");
        } catch (error) {
            console.error('Error updating leaderboard:', error);
            // Display error message to user
            const leaderboardBody = document.getElementById('leaderboardBody');
            leaderboardBody.innerHTML = '<tr><td colspan="3">Error loading leaderboard. Please try again later.</td></tr>';
        }
    }, 300); // 300ms debounce
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', updateLeaderboard);

// Export the function if you need to call it from other files
window.updateLeaderboard = updateLeaderboard;