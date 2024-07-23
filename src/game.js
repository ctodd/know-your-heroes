let heroes = [];
let questions = [];
let currentHero = null;
let currentQuestion = null;
let score = 0;
let askedQuestions = new Set();
let wrongAnswers = 0;
const MAX_WRONG_ANSWERS = 3;
let pendingScore = null;

async function loadGameData() {
    try {
        const heroesResponse = await fetch('aws_heroes.json');
        heroes = await heroesResponse.json();

        const questionsResponse = await fetch('aws_heroes_questions.json');
        const questionsData = await questionsResponse.json();
        questions = questionsData.trivia_questions;
    } catch (error) {
        console.error('Error loading game data:', error);
        showNotification('Error loading game data. Please try again.', 'error');
    }
}

function startGame() {
    score = 0;
    wrongAnswers = 0;
    askedQuestions.clear();
    updateScore();
    nextQuestion();
}

function nextQuestion() {
    if (wrongAnswers >= MAX_WRONG_ANSWERS) {
        endGame();
        return;
    }

    if (askedQuestions.size === questions.flatMap(q => q.questions).length) {
        showNotification("Congratulations! You've answered all questions. Starting over.", 'info');
        askedQuestions.clear();
    }

    currentHero = selectRandomHero();
    currentQuestion = selectRandomQuestion(currentHero.name);

    if (!currentQuestion) {
        nextQuestion();
        return;
    }

    displayQuestion();
}

function selectRandomHero() {
    return heroes[Math.floor(Math.random() * heroes.length)];
}

function selectRandomQuestion(heroName) {
    const heroQuestions = questions.find(q => q.hero_name === heroName);
    if (!heroQuestions) return null;

    const availableQuestions = heroQuestions.questions.filter(q => !askedQuestions.has(q.question));
    if (availableQuestions.length === 0) return null;

    const selectedQuestion = availableQuestions[Math.floor(Math.random() * availableQuestions.length)];
    askedQuestions.add(selectedQuestion.question);
    return selectedQuestion;
}

function displayQuestion() {
    document.getElementById('heroImage').src = currentHero.image_url;
    document.getElementById('heroName').textContent = currentHero.name;
    document.getElementById('question').textContent = currentQuestion.question;

    const answersContainer = document.getElementById('answers');
    answersContainer.innerHTML = '';

    shuffleArray(currentQuestion.options).forEach(option => {
        const button = document.createElement('button');
        button.textContent = option;
        button.addEventListener('click', () => checkAnswer(option));
        answersContainer.appendChild(button);
    });
}

function checkAnswer(selectedAnswer) {
    if (selectedAnswer === currentQuestion.correct_answer) {
        score++;
        updateScore();
        showNotification("Correct answer!", "success");
    } else {
        wrongAnswers++;
        showNotification(`Wrong answer. Correct answer was: ${currentQuestion.correct_answer}`, "error");
    }

    setTimeout(() => {
        nextQuestion();
    }, 2000);
}

async function endGame() {
    document.getElementById('game').style.display = 'none';
    document.getElementById('landing').style.display = 'block';
    showNotification(`Game Over! Your final score is ${score}.`, "info");

    const user = await getCurrentUser();
    if (user && score > 0) {
        await saveScore(score);
    } else if (!user && score > 0) {
        pendingScore = score;
        showAuthModal(false, score);
    }
}

function updateScore() {
    document.getElementById('scoreValue').textContent = score;
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

async function saveScore(score) {
    if (score === 0) return; // Don't save score if it's zero

    const user = await getCurrentUser();
    if (user) {
        try {
            // Refresh credentials
            await refreshCredentials();

            const docClient = new AWS.DynamoDB.DocumentClient({ region: awsConfig.tableGamesRegion });
            const params = {
                TableName: awsConfig.tableGames,
                Item: {
                    userId: user.username,
                    playerName: user.playerName || user.username,
                    score: score,
                    timestamp: new Date().toISOString(),
                    scorePartition: "SCORE"
                }
            };
            await docClient.put(params).promise();
            console.log('Score saved successfully');
            updateLeaderboard();
        } catch (error) {
            console.error('Error saving score:', error);
            showNotification('Error saving score. Please try again.', 'error');
        }
    } else {
        showNotification('Please log in or create an account to save your score.', 'info');
    }
}

async function savePendingScore() {
    if (pendingScore !== null) {
        await saveScore(pendingScore);
        pendingScore = null;
    }
}

// Call this function after successful login/signup
window.savePendingScore = savePendingScore;

loadGameData();