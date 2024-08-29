document.addEventListener("DOMContentLoaded", () => {
    const startScreen = document.getElementById('start-screen');
    const questionPhase = document.getElementById('question-phase');
    const endScreen = document.getElementById('end-screen');
    const leaderboardDisplay = document.getElementById('leaderboard-display');
    const timerDisplay = document.getElementById('timer-display');

    const startBtn = document.getElementById('start-btn');
    const submitQuestionBtn = document.getElementById('submit-question-btn');
    const submitGuessBtn = document.getElementById('submit-guess-btn');
    const restartBtn = document.getElementById('restart-btn');
    const requestHintBtn = document.getElementById('request-hint-btn');
    const shareBtn = document.getElementById('share-btn');
    const nextLevelBtn = document.getElementById('next-level-btn');

    const questionInput = document.getElementById('question-input');
    const guessInput = document.getElementById('guess-input');

    const questionResponse = document.getElementById('question-response');
    const guessResponse = document.getElementById('guess-response');
    const questionList = document.getElementById('question-list');
    const endMessage = document.getElementById('end-message');
    const scoreMessage = document.getElementById('score-message');
    const contextHint = document.getElementById('context-hint');
    const loadingSpinner = document.getElementById('loading-spinner');
    const categoryDisplay = document.getElementById('category-display');

    let gameData = null;
    let questionPool = [];
    let selectedAnswerObj = null;
    let questionCount = 0;
    let questionAnswerPairs = [];
    let difficulty = 'medium';
    let timeLeft = 60;
    let timerInterval;
    let totalScore = 0;
    let isGameOver = false;

    // Sound Manager
    const soundManager = {
        correct: new Audio('https://actions.google.com/sounds/v1/cartoon/siren_whistle.ogg'),
        wrong: new Audio('https://actions.google.com/sounds/v1/cartoon/cartoon_boing.ogg'),    
        play(sound) {
            this[sound].play();
        }
    };

    // Check if there's a score in localStorage
    if (localStorage.getItem('solvrTotalScore')) {
        totalScore = parseInt(localStorage.getItem('solvrTotalScore'), 10);
    }

    async function getApiKey() {
        try {
            const response = await fetch('/.netlify/functions/getApiKey');
            const data = await response.json();
            return data.apiKey;
        } catch (error) {
            console.error('Error fetching the API key:', error);
            return null;
        }
    }

    async function loadGameData() {
        try {
            const response = await fetch('data.json');
            gameData = await response.json();
        } catch (error) {
            displayError("Failed to load game data.");
            console.error("Failed to load game data:", error);
        }
    }

    function filterQuestionsByDifficulty() {
        questionPool = [];
        gameData.categories.forEach(category => {
            category.levels.forEach(level => {
                if (level.difficulty === difficulty) {
                    questionPool.push({ ...level, category: category.category });
                }
            });
        });
    }

    startBtn.addEventListener('click', async () => {
        difficulty = document.getElementById('difficulty-select').value;
        await loadGameData();
        filterQuestionsByDifficulty();
        totalScore = 0;  // Reset total score
        isGameOver = false;
        localStorage.removeItem('solvrTotalScore'); // Clear any stored score at game start
        nextLevel();
    });

    nextLevelBtn.addEventListener('click', () => {
        nextLevel();
    });

    function nextLevel() {
        if (isGameOver) return;

        if (questionPool.length > 0) {
            const randomIndex = Math.floor(Math.random() * questionPool.length);
            selectedAnswerObj = questionPool[randomIndex];
            selectedAnswerObj.answer = selectedAnswerObj.answer.toLowerCase();
            if (selectedAnswerObj.synonyms) {
                selectedAnswerObj.synonyms = selectedAnswerObj.synonyms.map(synonym => synonym.toLowerCase());
            }
            questionPool.splice(randomIndex, 1);

            categoryDisplay.textContent = `Category: ${selectedAnswerObj.category}`;
            categoryDisplay.classList.remove('hidden');

            applyCategoryTheme(selectedAnswerObj.category);

            if (difficulty === 'easy') {
                contextHint.textContent = `Context: ${selectedAnswerObj.hints[0]}`;
            } else if (difficulty === 'medium') {
                contextHint.textContent = `Hint: ${selectedAnswerObj.hints[0]}`;
            } else {
                contextHint.textContent = 'You get no hints on Hard difficulty!';
            }
            contextHint.classList.remove('hidden');

            timeLeft = difficulty === 'easy' ? 90 : difficulty === 'medium' ? 60 : 30;
            startTimer();

            questionCount = 0;
            questionAnswerPairs = [];
            questionList.innerHTML = '';
            questionResponse.classList.add('hidden');
            guessResponse.classList.add('hidden');
            endScreen.classList.add('hidden');
            leaderboardDisplay.classList.add('hidden');
            questionPhase.classList.remove('hidden');
            startScreen.classList.add('hidden');
        } else {
            endGame();
        }
    }

    submitQuestionBtn.addEventListener('click', async () => {
        const question = questionInput.value.trim();
        if (question) {
            questionCount++;
            showLoadingSpinner();

            try {
                const answer = await getYesNoAnswer(question);
                hideLoadingSpinner();

                questionResponse.textContent = answer;
                questionResponse.classList.remove('hidden');

                questionAnswerPairs.push({ question, answer });

                const li = document.createElement('li');
                li.textContent = `${questionCount}. ${question} - ${answer}`;
                questionList.appendChild(li);

                if (questionCount === 3 || questionCount === 6) {
                    provideHint();
                }

                questionInput.value = '';
            } catch (error) {
                hideLoadingSpinner();
                displayError("An error occurred while processing your question.");
                console.error("Error processing question:", error);
            }
        }
    });

    submitGuessBtn.addEventListener('click', () => {
        const guess = normalizeString(guessInput.value.trim());

        if (isCorrectGuess(guess, selectedAnswerObj.answer)) {
            const maxScore = 100; // Maximum possible score
            const deduction = calculateDeduction(questionCount);
            currentLevelScore = maxScore - deduction;
            totalScore += currentLevelScore;

            // Store the updated total score in localStorage
            localStorage.setItem('solvrTotalScore', totalScore);

            endMessage.textContent = `Great job! You guessed correctly in ${questionCount} questions.`;
            scoreMessage.textContent = `Your total score: ${totalScore} (out of ${maxScore} per level, minus penalties for ${questionCount} questions).`;
            triggerConfetti();
            soundManager.play('correct');

            // Automatically move to next level after a short delay
            setTimeout(nextLevel, 2000);
        } else {
            soundManager.play('wrong');
            guessResponse.textContent = "Incorrect guess. Keep trying!";
            guessResponse.classList.remove('hidden');
        }
        guessInput.value = '';
    });

    restartBtn.addEventListener('click', () => {
        totalScore = 0;
        filterQuestionsByDifficulty();
        isGameOver = false;
        localStorage.removeItem('solvrTotalScore'); // Clear the stored score on restart
        startScreen.classList.remove('hidden');
        endScreen.classList.add('hidden');
    });

    requestHintBtn.addEventListener('click', requestHint);

    shareBtn.addEventListener('click', () => {
        const tweetText = `I just scored ${totalScore} points on Solvr! Can you beat my score? Play the game here: ${window.location.href}`;
        const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
        window.open(tweetUrl, '_blank');
    });

    function normalizeString(str) {
        return str
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9\s]/gi, '');
    }

    function isCorrectGuess(guess, answer) {
        const normalizedGuess = normalizeString(guess);
        if (normalizedGuess === answer) {
            return true;
        }
        if (selectedAnswerObj.synonyms) {
            return selectedAnswerObj.synonyms.includes(normalizedGuess);
        }
        return false;
    }

    async function getYesNoAnswer(question) {
        const apiKey = process.env.OPEN_AI_KEY // await getApiKey();  // Get the API key from the Netlify function | process.env.OPEN_AI_KEY;

        if (!apiKey) {
            console.error('API key is missing!');
            return;
        }
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4-turbo",
                    messages: [
                        {
                            role: "system",
                            content: `You are playing a game where the answer is '${selectedAnswerObj.answer}'. Respond to the following question with a Yes or No answer, based on whether the question is relevant to this answer.`
                        },
                        {
                            role: "user",
                            content: question
                        }
                    ],
                    max_tokens: 5,
                    temperature: 0
                })
            });

            if (!response.ok) {
                throw new Error("Failed to fetch from OpenAI API");
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            displayError("An error occurred while communicating with the AI. Please try again.");
            console.error("OpenAI API error:", error);
            throw error;
        }
    }

    function showLoadingSpinner() {
        loadingSpinner.style.display = 'block';
    }

    function hideLoadingSpinner() {
        loadingSpinner.style.display = 'none';
    }

    function provideHint() {
        const hintIndex = questionCount === 3 ? 1 : 2;
        contextHint.textContent = `Hint: ${selectedAnswerObj.hints[hintIndex]}`;
    }

    function requestHint() {
        if (questionCount >= 6) return;
        provideHint();
        questionCount += 2;
    }

    function calculateDeduction(questionsAsked) {
        let deduction = 0;

        if (difficulty === 'easy') {
            deduction = questionsAsked * 5;
        } else if (difficulty === 'medium') {
            deduction = questionsAsked * 10;
        } else if (difficulty === 'hard') {
            deduction = questionsAsked * 15;
        }

        return deduction;
    }

    function triggerConfetti() {
        confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
        });
    }

    function applyCategoryTheme(category) {
        const themeColors = {
            "Product Management": "#FFA500",
            "Technology": "#008080",
            "Science": "#4CAF50",
            "History": "#8B4513",
            "General Knowledge": "#000080"
        };
        document.body.style.backgroundColor = themeColors[category] || "#ffffff";
    }

    function startTimer() {
        clearInterval(timerInterval);
        timerDisplay.classList.remove('hidden');
        timerInterval = setInterval(() => {
            timeLeft--;
            timerDisplay.textContent = `Time left: ${timeLeft}s`;
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                endGameWithTimeout();
            }
        }, 1000);
    }

    function endGameWithTimeout() {
        endMessage.textContent = "Time's up! You couldn't guess the answer in time.";
        scoreMessage.textContent = `Your total score: ${totalScore}`;

        endLevel();
    }

    function endLevel() {
        clearInterval(timerInterval);
        questionPhase.classList.add('hidden');
        endScreen.classList.remove('hidden');
    }

    function displayError(message) {
        questionResponse.textContent = message;
        questionResponse.classList.remove('hidden');
        questionResponse.classList.add('is-danger');
    }

    function endGame() {
        isGameOver = true;
        clearInterval(timerInterval);
        scoreMessage.textContent = `Your total score: ${totalScore}`;
        endMessage.textContent = "Congratulations! You've completed all levels.";
        questionPhase.classList.add('hidden');
        endScreen.classList.remove('hidden');
    }
});
