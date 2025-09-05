// Универсальный движок для образовательных тестов с Firebase интеграцией

class TestEngine {
    constructor(questions, config = {}) {
        this.questions = questions;
        this.config = {
            subject: config.subject || 'Тест',
            grade: config.grade || '',
            passingScore: config.passingScore || 50,
            ...config
        };
        
        this.currentQuestionIndex = 0;
        this.studentAnswers = {};
        this.studentName = "";
        this.studentClass = "";
        this.testStartTime = new Date();
        this.firebaseConfig = null;
        this.db = null;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadFirebaseConfig();
    }

    // Настройка Firebase
    async loadFirebaseConfig() {
        if (window.firebaseConfig) {
            try {
                const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
                const { getFirestore, collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
                
                this.firebaseConfig = window.firebaseConfig;
                const app = initializeApp(this.firebaseConfig);
                this.db = getFirestore(app);
                this.addDoc = addDoc;
                this.collection = collection;
                this.serverTimestamp = serverTimestamp;
                
                console.log('Firebase инициализирован успешно');
            } catch (error) {
                console.error('Ошибка инициализации Firebase:', error);
            }
        }
    }

    setupEventListeners() {
        document.addEventListener('DOMContentLoaded', () => {
            this.attachGlobalFunctions();
        });
    }

    attachGlobalFunctions() {
        window.startTest = () => this.startTest();
        window.nextQuestion = () => this.nextQuestion();
        window.previousQuestion = () => this.previousQuestion();
        window.finishTest = () => this.finishTest();
    }

    startTest() {
        const lastName = document.getElementById('lastName')?.value.trim();
        const firstName = document.getElementById('firstName')?.value.trim();
        const studentClass = document.getElementById('studentClass')?.value.trim();
        
        if (!lastName || !firstName) {
            this.showError('Пожалуйста, заполните все обязательные поля');
            return;
        }
        
        this.studentName = `${lastName} ${firstName}`;
        this.studentClass = studentClass || '';
        
        this.hideError();
        this.hideElement('loginForm');
        this.showElement('quizContainer');
        this.showElement('navigation');
        
        this.shuffleQuestions();
        this.showQuestion(0);
        this.updateProgress();
    }

    shuffleQuestions() {
        this.questions.forEach(question => {
            const correctAnswer = question.options[question.correct];
            const shuffled = [...question.options];
            
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            
            question.correct = shuffled.indexOf(correctAnswer);
            question.options = shuffled;
        });
    }

    showQuestion(index) {
        this.currentQuestionIndex = index;
        const question = this.questions[index];
        
        const questionHTML = `
            <div class="question fade-in">
                <h3>
                    <div class="question-number">${index + 1}</div>
                    ${question.text}
                </h3>
                <div class="options">
                    ${question.options.map((option, i) => `
                        <label class="option">
                            <input type="radio" name="q${question.id}" value="${i}" 
                                   ${this.studentAnswers[question.id] == i ? 'checked' : ''}>
                            <span class="option-text">${option}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.getElementById('questionContent').innerHTML = questionHTML;
        
        this.updateNavigation();
        this.attachAnswerListeners(question.id);
    }

    attachAnswerListeners(questionId) {
        const radioButtons = document.querySelectorAll(`input[name="q${questionId}"]`);
        radioButtons.forEach(radio => {
            radio.addEventListener('change', () => {
                this.studentAnswers[questionId] = parseInt(radio.value);
                this.animateSelection(radio.closest('.option'));
            });
        });
    }

    animateSelection(optionElement) {
        optionElement.style.transform = 'scale(1.05)';
        setTimeout(() => {
            optionElement.style.transform = 'scale(1)';
        }, 200);
    }

    updateNavigation() {
        const currentEl = document.getElementById('currentQuestion');
        const totalEl = document.getElementById('totalQuestions');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const submitContainer = document.getElementById('submitContainer');
        
        if (currentEl) currentEl.textContent = this.currentQuestionIndex + 1;
        if (totalEl) totalEl.textContent = this.questions.length;
        
        if (prevBtn) prevBtn.disabled = this.currentQuestionIndex === 0;
        
        const isLastQuestion = this.currentQuestionIndex === this.questions.length - 1;
        if (nextBtn) nextBtn.style.display = isLastQuestion ? 'none' : 'block';
        if (submitContainer) submitContainer.style.display = isLastQuestion ? 'block' : 'none';
    }

    nextQuestion() {
        if (this.currentQuestionIndex < this.questions.length - 1) {
            this.currentQuestionIndex++;
            this.showQuestion(this.currentQuestionIndex);
            this.updateProgress();
        }
    }

    previousQuestion() {
        if (this.currentQuestionIndex > 0) {
            this.currentQuestionIndex--;
            this.showQuestion(this.currentQuestionIndex);
            this.updateProgress();
        }
    }

    updateProgress() {
        const progress = ((this.currentQuestionIndex + 1) / this.questions.length) * 100;
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = progress + '%';
        }
    }

    async finishTest() {
        const unansweredQuestions = this.questions.filter(q => this.studentAnswers[q.id] === undefined);
        
        if (unansweredQuestions.length > 0) {
            if (!confirm(`Не отвечено на ${unansweredQuestions.length} вопрос(ов). Вы уверены, что хотите завершить тест?`)) {
                return;
            }
        }
        
        if (!confirm('Вы уверены, что хотите завершить тест? Изменить ответы после этого будет невозможно.')) {
            return;
        }
        
        await this.calculateResults();
    }

    async calculateResults() {
        let correctAnswers = 0;
        let missedGoals = [];
        let achievedGoals = [];
        let detailedAnswers = [];
        
        this.questions.forEach(question => {
            const studentAnswer = this.studentAnswers[question.id];
            const isCorrect = studentAnswer === question.correct;
            
            if (isCorrect) {
                correctAnswers++;
                if (question.goal && !achievedGoals.includes(question.goal)) {
                    achievedGoals.push(question.goal);
                }
            } else {
                if (question.goal && !missedGoals.some(item => item.goal === question.goal)) {
                    missedGoals.push({
                        questionId: question.id,
                        goal: question.goal,
                        question: question.text
                    });
                }
            }
            
            detailedAnswers.push({
                questionId: question.id,
                question: question.text,
                studentAnswer: studentAnswer !== undefined ? question.options[studentAnswer] : "Не отвечено",
                correctAnswer: question.options[question.correct],
                isCorrect: isCorrect,
                goal: question.goal || 'Не указана'
            });
        });
        
        const percentage = Math.round((correctAnswers / this.questions.length) * 100);
        const testEndTime = new Date();
        const testDuration = Math.round((testEndTime - this.testStartTime) / 60000);
        
        const gradeInfo = this.calculateGrade(percentage);
        
        this.hideElement('quizContainer');
        this.hideElement('navigation');
        this.hideElement('submitContainer');
        this.showElement('results');
        
        this.displayResults({
            correctAnswers,
            percentage,
            testDuration,
            gradeInfo,
            achievedGoals,
            missedGoals
        });
        
        // Сохранение в Firebase
        const resultData = {
            studentName: this.studentName,
            studentClass: this.studentClass,
            subject: this.config.subject,
            grade: this.config.grade,
            correctAnswers,
            totalQuestions: this.questions.length,
            percentage,
            numericGrade: gradeInfo.numeric,
            gradeText: gradeInfo.text,
            testDuration,
            achievedGoals,
            missedGoals: missedGoals.map(item => item.goal),
            detailedAnswers,
            testStartTime: this.testStartTime.toISOString(),
            testEndTime: testEndTime.toISOString()
        };
        
        await this.saveToFirebase(resultData);
    }

    calculateGrade(percentage) {
        if (percentage >= 85) {
            return { numeric: 5, text: "Отлично (5)", class: "grade-excellent" };
        } else if (percentage >= 70) {
            return { numeric: 4, text: "Хорошо (4)", class: "grade-good" };
        } else if (percentage >= this.config.passingScore) {
            return { numeric: 3, text: "Удовлетворительно (3)", class: "grade-satisfactory" };
        } else {
            return { numeric: 2, text: "Неудовлетворительно (2)", class: "grade-unsatisfactory" };
        }
    }

    displayResults({ correctAnswers, percentage, testDuration, gradeInfo, achievedGoals, missedGoals }) {
        const elements = {
            studentName: document.getElementById('studentName'),
            score: document.getElementById('score'),
            gradeBadge: document.getElementById('gradeBadge'),
            feedback: document.getElementById('feedback'),
            resultSummary: document.getElementById('resultSummary'),
            details: document.getElementById('details')
        };
        
        if (elements.studentName) {
            elements.studentName.textContent = this.studentClass ? 
                `${this.studentName} (${this.studentClass})` : 
                this.studentName;
        }
        
        if (elements.score) {
            elements.score.textContent = `${correctAnswers}/${this.questions.length} (${percentage}%)`;
        }
        
        if (elements.gradeBadge) {
            elements.gradeBadge.textContent = gradeInfo.text;
            elements.gradeBadge.className = `grade-badge ${gradeInfo.class}`;
        }
        
        if (elements.feedback) {
            const feedback = this.generateFeedback(percentage);
            elements.feedback.textContent = `${feedback} Время прохождения: ${testDuration} мин.`;
        }
        
        if (elements.resultSummary) {
            elements.resultSummary.innerHTML = this.generateResultSummary(correctAnswers, percentage, testDuration, gradeInfo);
        }
        
        if (elements.details) {
            elements.details.innerHTML = this.generateGoalsStatistics(achievedGoals, missedGoals);
        }
    }

    generateFeedback(percentage) {
        if (percentage >= 85) {
            return "Превосходный результат! Материал усвоен на отлично.";
        } else if (percentage >= 70) {
            return "Хороший результат! Материал в основном усвоен.";
        } else if (percentage >= this.config.passingScore) {
            return "Удовлетворительный результат. Рекомендуется повторить некоторые темы.";
        } else {
            return "Результат требует улучшения. Необходимо повторить материал.";
        }
    }

    generateResultSummary(correctAnswers, percentage, testDuration, gradeInfo) {
        return `
            <div class="result-card">
                <h4>Правильных ответов</h4>
                <div class="value">${correctAnswers}</div>
            </div>
            <div class="result-card">
                <h4>Процент</h4>
                <div class="value">${percentage}%</div>
            </div>
            <div class="result-card">
                <h4>Время</h4>
                <div class="value">${testDuration} мин</div>
            </div>
            <div class="result-card">
                <h4>Оценка</h4>
                <div class="value">${gradeInfo.numeric}</div>
            </div>
        `;
    }

    generateGoalsStatistics(achievedGoals, missedGoals) {
        return `
            <h3>Статистика по образовательным целям</h3>
            <div class="goals-grid">
                <div class="goals-achieved">
                    <h4>Достигнутые цели (${achievedGoals.length})</h4>
                    ${achievedGoals.length > 0 ? 
                        achievedGoals.map(goal => `<div class="goal-item">✅ ${goal}</div>`).join('') :
                        '<div class="goal-item">Нет достигнутых целей</div>'
                    }
                </div>
                <div class="goals-missed">
                    <h4>Не достигнутые цели (${missedGoals.length})</h4>
                    ${missedGoals.length > 0 ? 
                        missedGoals.map(item => `<div class="goal-item">❌ ${item.goal}</div>`).join('') :
                        '<div class="goal-item">Все цели достигнуты!</div>'
                    }
                </div>
            </div>
            ${missedGoals.length > 0 ? `
                <div class="details" style="margin-top: 20px;">
                    <h4>Вопросы, требующие внимания:</h4>
                    <ul class="missed-goals">
                        ${missedGoals.map(item => `
                            <li><strong>Цель ${item.goal}:</strong> ${item.question}</li>
                        `).join('')}
                    </ul>
                </div>
            ` : ''}
        `;
    }

    async saveToFirebase(data) {
        if (!this.db) {
            console.log('Firebase не настроен, результаты сохранены локально:', data);
            return;
        }

        this.showSendingMessage();

        try {
            const docRef = await this.addDoc(this.collection(this.db, "test-results"), {
                ...data,
                timestamp: this.serverTimestamp()
            });
            
            console.log("Результат сохранен в Firebase с ID: ", docRef.id);
            this.showSuccessMessage("Результаты успешно отправлены!");
            
        } catch (error) {
            console.error("Ошибка сохранения в Firebase: ", error);
            this.showErrorMessage("Не удалось отправить результаты. Проверьте подключение к интернету.");
        } finally {
            this.hideSendingMessage();
        }
    }

    // Утилиты для работы с DOM
    showElement(id) {
        const element = document.getElementById(id);
        if (element) {
            element.classList.remove('hidden');
            element.classList.add('fade-in');
        }
    }

    hideElement(id) {
        const element = document.getElementById(id);
        if (element) {
            element.classList.add('hidden');
        }
    }

    showError(message) {
        const errorEl = document.getElementById('loginError') || document.getElementById('error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    hideError() {
        const errorEl = document.getElementById('loginError') || document.getElementById('error');
        if (errorEl) {
            errorEl.classList.add('hidden');
        }
    }

    showSendingMessage() {
        const sendingEl = document.getElementById('sending');
        if (sendingEl) {
            sendingEl.textContent = 'Отправка результатов...';
            sendingEl.className = 'sending-message';
            sendingEl.classList.remove('hidden');
        }
    }

    hideSendingMessage() {
        const sendingEl = document.getElementById('sending');
        if (sendingEl) {
            sendingEl.classList.add('hidden');
        }
    }

    showSuccessMessage(message) {
        const successEl = document.getElementById('success');
        if (successEl) {
            successEl.textContent = message;
            successEl.className = 'success-message';
            successEl.classList.remove('hidden');
        }
    }

    showErrorMessage(message) {
        const errorEl = document.getElementById('firebaseError');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.className = 'error-message';
            errorEl.classList.remove('hidden');
        } else {
            alert(message);
        }
    }
}

// Глобальная функция для инициализации теста
window.initTest = function(questions, config = {}) {
    return new TestEngine(questions, config);
};

// Экспорт для модульного использования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestEngine;
}
