document.addEventListener('DOMContentLoaded', async () => {
    await loadGameData();
    
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const startGameBtn = document.getElementById('startGameBtn');
    const helpBtn = document.getElementById('helpBtn');
    const closeHelpBtn = document.getElementById('closeHelpBtn');

    loginBtn.addEventListener('click', () => showAuthModal(false));
    signupBtn.addEventListener('click', () => showAuthModal(true));
    logoutBtn.addEventListener('click', () => {
        logout();
    });

    startGameBtn.addEventListener('click', () => {
        document.getElementById('landing').style.display = 'none';
        document.getElementById('game').style.display = 'block';
        startGame();
    });

    helpBtn.addEventListener('click', () => {
        document.getElementById('helpModal').style.display = 'block';
    });

    closeHelpBtn.addEventListener('click', () => {
        document.getElementById('helpModal').style.display = 'none';
    });

    await checkSession();
    updateLeaderboard();
});

async function updateUI() {
    const user = await getCurrentUser();
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const logoutBtn = document.getElementById('logoutBtn');

    if (user) {
        loginBtn.style.display = 'none';
        signupBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
    } else {
        loginBtn.style.display = 'inline-block';
        signupBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
    }
}

function showNotification(message, type) {
    const modal = document.getElementById('notificationModal');
    const modalMessage = document.getElementById('modalMessage');
    modalMessage.textContent = message;
    
    if (type === "success") {
        modalMessage.style.color = "green";
    } else if (type === "error") {
        modalMessage.style.color = "red";
    } else {
        modalMessage.style.color = "black";
    }
    
    modal.style.display = "block";
    
    setTimeout(() => {
        modal.style.display = "none";
    }, 2000);
}

// Add event listener for auth modal close button
document.addEventListener('DOMContentLoaded', () => {
    const closeAuthModalBtn = document.createElement('button');
    closeAuthModalBtn.textContent = 'Close';
    closeAuthModalBtn.classList.add('close-modal-btn');
    closeAuthModalBtn.addEventListener('click', closeAuthModal);
    document.querySelector('#authModal .modal-content').appendChild(closeAuthModalBtn);
});