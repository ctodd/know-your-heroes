let userPool;
let cognitoUser;

function initCognito() {
    userPool = new AmazonCognitoIdentity.CognitoUserPool({
        UserPoolId: awsConfig.userPoolId,
        ClientId: awsConfig.userPoolWebClientId
    });
    checkSession();
}

async function checkSession() {
    const user = await getCurrentUser();
    if (user) {
        await refreshCredentials();
        updateUI();
    }
}

async function refreshCredentials() {
    return new Promise((resolve, reject) => {
        const cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) {
            cognitoUser.getSession((err, session) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                AWS.config.region = awsConfig.region;
                AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                    IdentityPoolId: awsConfig.identityPoolId,
                    Logins: {
                        [`cognito-idp.${awsConfig.region}.amazonaws.com/${awsConfig.userPoolId}`]: session.getIdToken().getJwtToken()
                    }
                });

                AWS.config.credentials.refresh((error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        } else {
            resolve();
        }
    });
}

function showAuthModal(isSignUp = false, score = null) {
    const authModal = document.getElementById('authModal');
    const authModalTitle = document.getElementById('authModalTitle');
    const cognitoUI = document.getElementById('cognitoUI');

    authModalTitle.textContent = isSignUp ? 'Sign Up' : 'Login';
    cognitoUI.innerHTML = '';

    if (score !== null) {
        const scoreMessage = document.createElement('p');
        scoreMessage.textContent = `Your score: ${score}. Login or create an account to save your score!`;
        cognitoUI.appendChild(scoreMessage);
    }

    const form = document.createElement('form');
    form.innerHTML = `
        ${isSignUp ? '<input type="text" id="playerName" placeholder="Player Name" required>' : ''}
        <input type="text" id="username" placeholder="Email Address" required autocomplete="username">
        <input type="password" id="password" placeholder="Password" required autocomplete="current-password">
        <button type="submit">${isSignUp ? 'Sign Up' : 'Login'}</button>
    `;

    form.onsubmit = (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        if (isSignUp) {
            const playerName = document.getElementById('playerName').value;
            signUp(username, password, playerName);
        } else {
            login(username, password);
        }
    };

    cognitoUI.appendChild(form);

    if (score !== null) {
        const toggleButton = document.createElement('button');
        toggleButton.textContent = isSignUp ? 'Already have an account? Login' : 'New user? Sign up';
        toggleButton.onclick = () => showAuthModal(!isSignUp, score);
        cognitoUI.appendChild(toggleButton);
    }

    authModal.style.display = 'block';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

function showConfirmationModal(username) {
    const authModal = document.getElementById('authModal');
    const authModalTitle = document.getElementById('authModalTitle');
    const cognitoUI = document.getElementById('cognitoUI');

    authModalTitle.textContent = 'Confirm Account';
    cognitoUI.innerHTML = '';

    const form = document.createElement('form');
    form.innerHTML = `
        <input type="text" id="confirmationCode" placeholder="Confirmation Code" required>
        <button type="submit">Confirm Account</button>
    `;

    form.onsubmit = (e) => {
        e.preventDefault();
        const confirmationCode = document.getElementById('confirmationCode').value;
        confirmSignUp(username, confirmationCode);
    };

    cognitoUI.appendChild(form);
    authModal.style.display = 'block';
}

async function signUp(username, password, playerName) {
    return new Promise((resolve, reject) => {
        userPool.signUp(username, password, [
            { Name: 'custom:playerName', Value: playerName }
        ], null, (err, result) => {
            if (err) {
                showNotification(err.message, 'error');
                reject(err);
            } else {
                showNotification('Signup successful! Please check your email for the confirmation code.', 'success');
                showConfirmationModal(username);
                resolve(result.user);
            }
        });
    });
}

function confirmSignUp(username, confirmationCode) {
    cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: username,
        Pool: userPool
    });

    cognitoUser.confirmRegistration(confirmationCode, true, (err, result) => {
        if (err) {
            showNotification(err.message, 'error');
        } else {
            showNotification('Account confirmed successfully! You can now log in.', 'success');
            closeAuthModal();
            showAuthModal(false);
        }
    });
}

async function login(username, password) {
    const authenticationData = {
        Username: username,
        Password: password
    };
    const authenticationDetails = new AmazonCognitoIdentity.AuthenticationDetails(authenticationData);

    cognitoUser = new AmazonCognitoIdentity.CognitoUser({
        Username: username,
        Pool: userPool
    });

    return new Promise((resolve, reject) => {
        cognitoUser.authenticateUser(authenticationDetails, {
            onSuccess: async result => {
                AWS.config.region = awsConfig.region;
                AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                    IdentityPoolId: awsConfig.identityPoolId,
                    Logins: {
                        [`cognito-idp.${awsConfig.region}.amazonaws.com/${awsConfig.userPoolId}`]: result.getIdToken().getJwtToken()
                    }
                });
                
                try {
                    await refreshCredentials();
                    showNotification('Login successful!', 'success');
                    closeAuthModal();
                    updateUI();
                    updateLeaderboard();
                    await savePendingScore(); // Save pending score after successful login
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            },
            onFailure: err => {
                if (err.code === 'UserNotConfirmedException') {
                    showNotification('Please confirm your account.', 'info');
                    showConfirmationModal(username);
                } else {
                    showNotification(err.message, 'error');
                }
                reject(err);
            }
        });
    });
}

function logout() {
    if (cognitoUser) {
        cognitoUser.signOut();
    }
    AWS.config.credentials = new AWS.CognitoIdentityCredentials({});
    localStorage.clear(); // Clear all local storage
    cognitoUser = null;
    showNotification('Logged out successfully!', 'info');
    updateUI();
    // Clear leaderboard after logout
    updateLeaderboard();
}

async function getCurrentUser() {
    return new Promise((resolve, reject) => {
        const cognitoUser = userPool.getCurrentUser();
        if (!cognitoUser) {
            resolve(null);
        } else {
            cognitoUser.getSession((err, session) => {
                if (err) {
                    reject(err);
                } else if (!session.isValid()) {
                    cognitoUser.signOut();
                    resolve(null);
                } else {
                    cognitoUser.getUserAttributes((err, attributes) => {
                        if (err) {
                            reject(err);
                        } else {
                            const playerName = attributes.find(attr => attr.Name === 'custom:playerName');
                            resolve({
                                username: cognitoUser.username,
                                playerName: playerName ? playerName.Value : cognitoUser.username,
                                attributes: attributes
                            });
                        }
                    });
                }
            });
        }
    });
}

// Initialize Cognito when the script loads
initCognito();