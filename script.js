// Correct and Incorrect Sounds
const correctSound = new Audio('correct.mp3');
const wrongSound = new Audio('wrong.mp3');

const GOOGLE_FORM_ACTION_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe4SoSBelbY2Sj1qWYzDf0lpCuQZtOHZDP7hXlmxtfr0Giwfw/formResponse';

const ENTRY_ID = 'entry.981422256';
const ENTRY_RESULT_FIRST_ROUND = 'entry.2021293174';
const ENTRY_RESULT_SECOND_ROUND = 'entry.396635597';
const ENTRY_TIME_FIRST_ROUND = 'entry.1537086722';
const ENTRY_TIME_SECOND_ROUND = 'entry.362684678';
const ENTRY_WRONG_SENTENCES_FIRST_ROUND = 'entry.1589100333';
const ENTRY_WRONG_SENTENCES_SECOND_ROUND = 'entry.1907649399';

let questions = [];
let currentQuestionIndex = 0;
let startTime;
let timerInterval;
let isPhotoQuiz = false;
let excelData = {};
let results = [];

// Dementia Counter
let dementiaStartTime = new Date().getTime();
let dementiaCounterElement = document.getElementById('dementiaCount');

// Load saved data from localStorage
window.addEventListener('DOMContentLoaded', () => {
    // Update Dementia Counter Every Second
    setInterval(updateDementiaCounter, 1000);

    const savedExcelURL = localStorage.getItem('excelURL');
    if (savedExcelURL) {
        document.getElementById('excelURL').value = savedExcelURL;
    }

    // Load saved statement count
    const savedStatementCount = localStorage.getItem('statementCount');
    if (savedStatementCount) {
        document.getElementById('statementCount').value = savedStatementCount;
    }

    // Load saved quiz type
    const savedQuizType = localStorage.getItem('quizType');
    if (savedQuizType) {
        isPhotoQuiz = savedQuizType === 'photos';
        updateToggleButtons();
    }

    // Load saved player name
    const savedPlayerName = localStorage.getItem('playerName');
    if (savedPlayerName) {
        document.getElementById('playerName').value = savedPlayerName;
    }

    // Save player name to localStorage when edited
    document.getElementById('playerName').addEventListener('input', function() {
        localStorage.setItem('playerName', this.value);
    });
});

// Update Dementia Counter Function
function updateDementiaCounter() {
    let now = new Date().getTime();
    let elapsedSeconds = Math.floor((now - dementiaStartTime) / 1000);
    let count = Math.floor(elapsedSeconds / 3);
    dementiaCounterElement.textContent = count;
}

// Toggle button event listeners
document.getElementById('toggleSentences').addEventListener('click', () => {
    isPhotoQuiz = false;
    localStorage.setItem('quizType', 'sentences');
    updateToggleButtons();
});

document.getElementById('togglePhotos').addEventListener('click', () => {
    isPhotoQuiz = true;
    localStorage.setItem('quizType', 'photos');
    updateToggleButtons();
});

function updateToggleButtons() {
    document.getElementById('toggleSentences').classList.toggle('selected', !isPhotoQuiz);
    document.getElementById('togglePhotos').classList.toggle('selected', isPhotoQuiz);
}

// Event listeners for sample data buttons
document.getElementById('sampleData1').addEventListener('click', () => {
    useSampleData('https://docs.google.com/spreadsheets/d/1IVlVUsAzBYXargHH37VSpLlm0YvapRtYe97LPY95LqA/pub?output=xlsx');
});

document.getElementById('sampleData2').addEventListener('click', () => {
    useSampleData('https://docs.google.com/spreadsheets/d/1ceAhk2BDTjCJXDCcMaINtPnWcLC23GrA_e9orZSNIVA/pub?output=xlsx');
});

function useSampleData(url) {
    document.getElementById('excelURL').value = url;
}

// Event listener for the "Começar o Quiz" button
document.getElementById("startQuizBtn").addEventListener("click", async function() {
    const excelURL = document.getElementById("excelURL").value.trim();
    const statementCount = parseInt(document.getElementById("statementCount").value, 10);

    if (!excelURL || isNaN(statementCount) || statementCount < 1 || statementCount > 20) {
        alert("Preencha todos os campos corretamente.");
        return;
    }

    // Validate URL
    if (!isValidURL(excelURL)) {
        alert("Por favor, insira uma URL válida.");
        return;
    }

    // Reset previous results
    results = [];
    currentQuestionIndex = 0;

    // Save data to localStorage
    localStorage.setItem('excelURL', excelURL);
    localStorage.setItem('statementCount', statementCount);

    try {
        await loadExcelData(excelURL);

        // Check if there are enough questions
        if (isPhotoQuiz && excelData.photos.length < statementCount) {
            alert("Não temos um número suficiente de dados. Adicione dados ou diminua o número de perguntas pedido.");
            return;
        } else if (!isPhotoQuiz && excelData.sentences.length < statementCount) {
            alert("Não temos um número suficiente de dados. Adicione dados ou diminua o número de perguntas pedido.");
            return;
        }

        generateQuestions(statementCount);
        enterFullScreenMode();
        showQuestion(currentQuestionIndex);
    } catch (error) {
        console.error('Error loading Excel data:', error);
        alert("Erro ao carregar dados do Excel: " + error.message);
    }
});

function isValidURL(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        return false;
    }
}

async function loadExcelData(url) {
    return new Promise((resolve, reject) => {
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.arrayBuffer();
            })
            .then(data => {
                const workbook = XLSX.read(data, { type: 'array' });
                const sentencesSheet = workbook.Sheets['Afirmações'];
                const photosSheet = workbook.Sheets['Fotos'];

                if (!sentencesSheet || !photosSheet) {
                    throw new Error('Planilhas "Afirmações" ou "Fotos" não encontradas.');
                }

                const sentences = XLSX.utils.sheet_to_json(sentencesSheet, { header: ['V ou F', 'Afirmação'], range: 1 });
                const photos = XLSX.utils.sheet_to_json(photosSheet, { header: ['Nome', 'Sexo (M ou F)', 'URL da foto'], range: 1 });

                // Normalize "V ou F" to lowercase
                sentences.forEach(s => {
                    s['V ou F'] = s['V ou F'].toLowerCase();
                });

                excelData = {
                    sentences: sentences,
                    photos: photos
                };
                resolve();
            })
            .catch(error => {
                reject(error);
            });
    });
}

function generateQuestions(count) {
    questions = [];

    if (isPhotoQuiz) {
        const photosCopy = [...excelData.photos];
        shuffleArray(photosCopy);
        const selectedPhotos = photosCopy.slice(0, count);

        selectedPhotos.forEach(photo => {
            const isTrue = Math.random() < 0.5;
            let questionText = photo['Nome'];

            if (!isTrue) {
                // Find another name with the same gender
                const sameGenderPhotos = excelData.photos.filter(p => p['Sexo (M ou F)'] === photo['Sexo (M ou F)'] && p !== photo);
                let falseNamePhoto;

                do {
                    falseNamePhoto = sameGenderPhotos[Math.floor(Math.random() * sameGenderPhotos.length)];
                } while (falseNamePhoto && photo['Nome'].split(' ')[0] === falseNamePhoto['Nome'].split(' ')[0]);

                if (falseNamePhoto) {
                    questionText = falseNamePhoto['Nome'];
                }
            }

            questions.push({
                text: questionText,
                correctAnswer: isTrue ? 'yes' : 'no',
                imageUrl: photo['URL da foto'],
                correctName: photo['Nome'] // For saving the correct name when the answer is wrong
            });
        });

    } else {
        const sentencesCopy = [...excelData.sentences];
        shuffleArray(sentencesCopy);
        const selectedSentences = sentencesCopy.slice(0, count);

        selectedSentences.forEach(sentence => {
            questions.push({
                text: sentence['Afirmação'],
                correctAnswer: sentence['V ou F'] === 'v' ? 'yes' : 'no',
                imageUrl: null
            });
        });
    }
}

document.getElementById("nextQuestionBtn").addEventListener("click", function() {
    nextQuestion();
});
document.getElementById("closeQuizBtn").addEventListener("click", function() {
    closeQuiz();
});

function enterFullScreenMode() {
    const quizContainer = document.getElementById("quizContainer");
    quizContainer.style.display = "flex"; // Show the quiz
    document.querySelector('.container').style.display = 'none'; // Hide input fields
    if (quizContainer.requestFullscreen) {
        quizContainer.requestFullscreen();
    } else if (quizContainer.webkitRequestFullscreen) { /* Safari */
        quizContainer.webkitRequestFullscreen();
    } else if (quizContainer.msRequestFullscreen) { /* IE11 */
        quizContainer.msRequestFullscreen();
    }
}

function startTimer() {
    startTime = new Date();
    timerInterval = setInterval(() => {
        let elapsedTime = new Date() - startTime;
        let minutes = Math.floor(elapsedTime / 60000);
        let seconds = ((elapsedTime % 60000) / 1000).toFixed(0);
        document.getElementById("timer").textContent = (minutes < 10 ? '0' : '') + minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function showQuestion(index) {
    const question = questions[index];
    document.getElementById("question").textContent = question.text;
    document.getElementById("questionNumber").textContent = "Pergunta: " + (index % questions.length + 1);

    if (isPhotoQuiz) {
        document.getElementById("quizImage").src = question.imageUrl;
        document.getElementById("quizImage").style.display = 'block';
    } else {
        document.getElementById("quizImage").style.display = 'none';
    }

    startTimer();

    // Reset button styles
    const answerButtons = document.querySelectorAll(".answer-buttons .btn");
    answerButtons.forEach(button => {
        button.style.backgroundColor = ""; // Remove any inline style
        button.classList.add("btn-blue"); // Add class for blue color
        button.disabled = false; // Enable buttons
    });
}

// Event listeners for answer buttons
document.getElementById('answerYes').addEventListener('click', () => answer('yes'));
document.getElementById('answerNo').addEventListener('click', () => answer('no'));
document.getElementById('answerIdk').addEventListener('click', () => answer('idk'));

function answer(givenAnswer) {
    stopTimer();
    const endTime = new Date();
    const timeTaken = (endTime - startTime) / 1000;
    const correctAnswer = questions[currentQuestionIndex % questions.length].correctAnswer;

    // Disable all answer buttons temporarily
    const answerButtons = document.querySelectorAll(".answer-buttons .btn");
    answerButtons.forEach(button => {
        button.disabled = true;
        if (button.getAttribute("data-answer") === givenAnswer) {
            button.style.backgroundColor = "grey"; // Change the clicked button to grey
        }
    });

    setTimeout(() => {
        let isCorrect = false; // Flag to indicate if the given answer is correct
        answerButtons.forEach(button => {
            if (button.getAttribute("data-answer") === correctAnswer) {
                button.style.backgroundColor = "green"; // Change the correct button to green
                if (givenAnswer === correctAnswer) {
                    isCorrect = true; // Set flag to true if user's answer is correct
                }
            } else if (button.getAttribute("data-answer") !== givenAnswer) {
                button.style.backgroundColor = ""; // Reset other buttons
            }
        });

        // Play the correct or incorrect sound
        if (isCorrect) {
            correctSound.play();
        } else {
            wrongSound.play();
        }

        setTimeout(() => {
            recordAnswer(givenAnswer, timeTaken, Math.floor(currentQuestionIndex / questions.length) + 1);
            nextQuestion(); // Move to the next question
        }, 1000); // Wait before moving to the next question
    }, 1000);
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

// Modified startSecondRound to avoid starting with the same last question
function startSecondRound() {
    const lastQuestionIndex = (currentQuestionIndex - 1) % questions.length;
    shuffleArray(questions); // Shuffle questions for the second round

    // Ensure the first question of the second round is not the same as the last question of the first round
    if (questions[0] === questions[lastQuestionIndex]) {
        if (questions.length > 1) {
            [questions[0], questions[1]] = [questions[1], questions[0]];
        }
    }

    currentQuestionIndex = questions.length; // Continue counting from the end of the first round
    showQuestion(currentQuestionIndex % questions.length);
}

function nextQuestion() {
    currentQuestionIndex++;
    // Check if first round is completed
    if (currentQuestionIndex === questions.length && results.length < questions.length * 2) {
        startSecondRound(); // Start the second round
    } else if (currentQuestionIndex < questions.length * 2) {
        showQuestion(currentQuestionIndex % questions.length);
    } else {
        // After second round, show results
        closeQuiz();
        showResults();
    }
}

function closeQuiz() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.webkitExitFullscreen) { /* Safari */
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) { /* IE11 */
        document.msExitFullscreen();
    }
    document.getElementById("quizContainer").style.display = "none"; // Hide the quiz
    document.querySelector('.container').style.display = 'block'; // Show input fields again
    currentQuestionIndex = 0; // Reset for possible restart

    // Re-populate input fields with stored data
    const savedExcelURL = localStorage.getItem('excelURL');
    if (savedExcelURL) {
        document.getElementById('excelURL').value = savedExcelURL;
    }

    const savedStatementCount = localStorage.getItem('statementCount');
    if (savedStatementCount) {
        document.getElementById('statementCount').value = savedStatementCount;
    }
}

function recordAnswer(answer, timeTaken, round) {
    const question = questions[currentQuestionIndex % questions.length];
    const correct = answer === question.correctAnswer;
    results.push({
        questionIndex: currentQuestionIndex % questions.length,
        answer: answer,
        correct: correct,
        timeTaken: timeTaken,
        round: round,
        correctName: question.correctName || null // For photo quiz
    });
}

function showPerformanceTable(resultsDiv) {
    const performanceTable = document.createElement("table");

    const theadPerf = document.createElement("thead");
    const tbodyPerf = document.createElement("tbody");

    const headerRowPerf = document.createElement("tr");
    ["Pergunta", "1ª Ronda", "Repetição"].forEach(text => {
        const th = document.createElement("th");
        th.textContent = text;
        headerRowPerf.appendChild(th);
    });
    theadPerf.appendChild(headerRowPerf);
    performanceTable.appendChild(theadPerf);

    questions.forEach((question, index) => {
        const row = document.createElement("tr");
        const questionCell = document.createElement("td");
        questionCell.textContent = `${index + 1}`;
        row.appendChild(questionCell);

        [1, 2].forEach(round => {
            const td = document.createElement("td");
            const result = results.find(r => r.questionIndex === index && r.round === round);
            td.style.backgroundColor = result.correct ? "#2ecc71" : result.answer === "idk" ? "#f1c40f" : "#e74c3c";
            td.style.color = "white";
            td.textContent = result.correct ? "Correta" : result.answer === "idk" ? "Não sei" : "Incorreta";
            row.appendChild(td);
        });

        tbodyPerf.appendChild(row);
    });

    performanceTable.appendChild(tbodyPerf);
    resultsDiv.appendChild(performanceTable);
}

function showResults() {
    const resultsDiv = document.getElementById('resultsContainer');
    resultsDiv.style.display = 'block'; // Show results container
    resultsDiv.innerHTML = ''; // Clear previous results if any

    // Calculate results
    const correctFirstRound = results.filter(r => r.round === 1 && r.correct).length;
    const correctSecondRound = results.filter(r => r.round === 2 && r.correct).length;
    const percentageCorrectFirstRound = ((correctFirstRound / questions.length) * 100).toFixed(2); // Calculate percentage
    const percentageCorrectSecondRound = ((correctSecondRound / questions.length) * 100).toFixed(2); // Calculate percentage
    const timeFirstRound = results.filter(r => r.round === 1).reduce((acc, r) => acc + r.timeTaken, 0) / questions.length;
    const timeSecondRound = results.filter(r => r.round === 2).reduce((acc, r) => acc + r.timeTaken, 0) / questions.length;

    // Collect wrong sentences
    const wrongSentencesFirstRound = results.filter(r => r.round === 1 && !r.correct).map(r => {
        if (isPhotoQuiz) {
            return `Foto de ${questions[r.questionIndex].correctName}`;
        } else {
            return questions[r.questionIndex].text;
        }
    }).join('; ');

    const wrongSentencesSecondRound = results.filter(r => r.round === 2 && !r.correct).map(r => {
        if (isPhotoQuiz) {
            return `Foto de ${questions[r.questionIndex].correctName}`;
        } else {
            return questions[r.questionIndex].text;
        }
    }).join('; ');

    // Retrieve player name
    const playerName = localStorage.getItem('playerName') || 'Unknown Player';

    // Prepare form data as URL-encoded string
    const formData = new URLSearchParams();
    formData.append(ENTRY_ID, playerName);
    formData.append(ENTRY_RESULT_FIRST_ROUND, percentageCorrectFirstRound); // Send percentage
    formData.append(ENTRY_RESULT_SECOND_ROUND, percentageCorrectSecondRound); // Send percentage
    formData.append(ENTRY_TIME_FIRST_ROUND, timeFirstRound.toFixed(2));
    formData.append(ENTRY_TIME_SECOND_ROUND, timeSecondRound.toFixed(2));
    formData.append(ENTRY_WRONG_SENTENCES_FIRST_ROUND, wrongSentencesFirstRound || '-');
    formData.append(ENTRY_WRONG_SENTENCES_SECOND_ROUND, wrongSentencesSecondRound || '-');

    // Submit data to Google Form
    fetch(GOOGLE_FORM_ACTION_URL, {
        method: 'POST',
        mode: 'no-cors', // Bypasses CORS policy restrictions
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded' // Ensures correct encoding
        },
        body: formData.toString() // Converts formData to a URL-encoded string
    })
    .then(() => {
        console.log('Form submitted successfully.');
    })
    .catch((error) => {
        console.error('Error submitting form:', error);
    });

    // Display results
    const summaryTable = document.createElement("table");

    const tbody = document.createElement("tbody");

    // Headers
    const headerRow = document.createElement("tr");
    headerRow.appendChild(createHeaderCell(""));
    headerRow.appendChild(createHeaderCell("1ª Ronda"));
    headerRow.appendChild(createHeaderCell("Repetição"));
    tbody.appendChild(headerRow);

    // Percentage Correct
    const correctRow = document.createElement("tr");
    correctRow.appendChild(createCell("% Corretas"));
    [percentageCorrectFirstRound, percentageCorrectSecondRound].forEach(percentageCorrect => {
        correctRow.appendChild(createCell(percentageCorrect + '%'));
    });
    tbody.appendChild(correctRow);

    // Average Time
    const timeRow = document.createElement("tr");
    timeRow.appendChild(createCell("Tempo Médio (s)"));
    [timeFirstRound, timeSecondRound].forEach(avgTime => {
        timeRow.appendChild(createCell(avgTime.toFixed(2)));
    });
    tbody.appendChild(timeRow);

    summaryTable.appendChild(tbody);
    resultsDiv.appendChild(summaryTable);

    // Continue with showing performance table and charts
    showPerformanceTable(resultsDiv);

    // Plotly Boxplot
    const plotDiv = document.createElement('div');
    plotDiv.id = 'plotDiv';
    resultsDiv.appendChild(plotDiv);

    const timesFirstRound = results.filter(r => r.round === 1).map(r => r.timeTaken);
    const timesSecondRound = results.filter(r => r.round === 2).map(r => r.timeTaken);

    Plotly.newPlot(plotDiv, [
        {
            y: timesFirstRound,
            type: 'box',
            name: '1ª Ronda',
            marker: {color: '#C0C0C0'}
        },
        {
            y: timesSecondRound,
            type: 'box',
            name: 'Repetição',
            marker: {color: '#71797E'}
        }
    ], {
        title: 'Comparação dos Tempos de Resposta',
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: {color: '#333'},
        xaxis: {title: 'Rondas'},
        yaxis: {title: 'Tempo (s)'}
    }, {responsive: true});
}

// Helper function to create a cell
function createCell(text) {
    const cell = document.createElement("td");
    cell.textContent = text;
    return cell;
}

function createHeaderCell(text) {
    const cell = document.createElement("th");
    cell.textContent = text;
    return cell;
}
