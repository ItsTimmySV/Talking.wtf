// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyB1RH4jojDz8zExIOiwmvkXtRy0R0I7xgs",
    authDomain: "languageacademy-b830a.firebaseapp.com",
    databaseURL: "https://languageacademy-b830a-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "languageacademy-b830a",
    storageBucket: "languageacademy-b830a.appspot.com",
    messagingSenderId: "849632826608",
    appId: "1:849632826608:web:7290467ebe776f473e1e35"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get elements
const authForm = document.getElementById('authForm');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logout');
const authContainer = document.getElementById('authContainer');
const dashboard = document.getElementById('dashboard');
const studentPaymentForm = document.getElementById('studentPaymentForm');
const expenseRecordForm = document.getElementById('expenseRecordForm');
const studentPopup = document.getElementById('studentPopup');
const closePopup = document.getElementsByClassName('close')[0];
const studentPaymentHistory = document.getElementById('studentPaymentHistory');
const expenseItems = document.getElementById('expenseItems');
const paymentsTableBody = document.getElementById('paymentsTableBody');
const balanceAmount = document.getElementById('balanceAmount');
const downloadHistoryBtn = document.getElementById('downloadHistoryBtn');

// Update income chart
let incomeChart;
let lastMonthlyIncomeData = {};

let incomeExpenseChart;
function updateIncomeExpenseChart(monthlyIncome, monthlyExpenses) {
    const ctx = document.getElementById('monthlyIncomeChart');
    if (!ctx) {
        console.error('Canvas element not found');
        return;
    }

    if (incomeExpenseChart) {
        incomeExpenseChart.destroy();
    }

    const chartType = window.innerWidth < 480 ? 'line' : 'bar';

    incomeExpenseChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: Object.keys(monthlyIncome), // Assuming income and expense have the same months
            datasets: [
                {
                    label: 'Monthly Income',
                    data: Object.values(monthlyIncome),
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Monthly Expenses',
                    data: Object.values(monthlyExpenses),
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 1,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Amount ($)'
                    },
                    ticks: {
                        callback: function(value, index, values) {
                            return '$' + value;
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                },
                title: {
                    display: true,
                    text: 'Monthly Income & Expenses'
                }
            }
        }
    });
}

// Function to generate the invoice PDF and trigger download
async function generateInvoicePDF(studentName, paymentData) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text('Invoice', 20, 20);

    // Add student name
    doc.setFontSize(14);
    doc.text(`Student Name: ${studentName}`, 20, 30);

    // Add table headers
    doc.setFontSize(12);
    doc.text('Date', 20, 40);
    doc.text('Category', 60, 40);
    doc.text('Amount', 140, 40);

    // Add table data
    let y = 50;
    let totalAmount = 0;
    paymentData.forEach((payment) => {
        doc.text(payment.date, 20, y);
        doc.text(payment.category, 60, y);
        doc.text(`$${payment.amount.toFixed(2)}`, 140, y);
        y += 10;
        totalAmount += payment.amount;
    });

    // Add total amount
    doc.text(`Total: $${totalAmount.toFixed(2)}`, 140, y + 10);

    // Save the PDF and trigger a download
    const fileName = `Invoice_${studentName.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);
}

// Calculate and display total balance
async function updateBalance() {
    const user = firebase.auth().currentUser;
    if (user) {
        const paymentRef = firebase.database().ref('payments/' + user.uid);
        const expenseRef = firebase.database().ref('expenses/' + user.uid);

        try {
            const [paymentSnapshot, expenseSnapshot] = await Promise.all([
                paymentRef.once('value'),
                expenseRef.once('value')
            ]);

            let totalIncome = 0;
            let totalExpenses = 0;

            paymentSnapshot.forEach((childSnapshot) => {
                totalIncome += childSnapshot.val().amount;
            });

            expenseSnapshot.forEach((childSnapshot) => {
                totalExpenses += childSnapshot.val().amount;
            });

            const balance = totalIncome - totalExpenses;
            balanceAmount.textContent = `$${balance.toFixed(2)}`;
            document.getElementById('incomeAmount').textContent = `$${totalIncome.toFixed(2)}`;
            document.getElementById('expenseAmount').textContent = `$${totalExpenses.toFixed(2)}`;
        } catch (error) {
            console.error('Error calculating balance:', error);
        }
    }
}


// Load and display payments with grouping by student name
function loadPayments() {
    const user = firebase.auth().currentUser;
    if (user) {
        const paymentRef = firebase.database().ref('payments/' + user.uid);
        paymentRef.on('value', (snapshot) => {
            const paymentSummary = {};

            // Summarize payments by student name
            snapshot.forEach((childSnapshot) => {
                const payment = childSnapshot.val();
                if (!paymentSummary[payment.studentName]) {
                    paymentSummary[payment.studentName] = {
                        totalAmount: 0,
                        paymentCount: 0,
                        lastPaymentDate: payment.date,
                        category: payment.category
                    };
                }
                paymentSummary[payment.studentName].totalAmount += payment.amount;
                paymentSummary[payment.studentName].paymentCount += 1;
                paymentSummary[payment.studentName].lastPaymentDate = payment.date;
            });

            // Populate the table with the summarized data
            paymentsTableBody.innerHTML = '';
            Object.keys(paymentSummary).forEach((studentName) => {
                const summary = paymentSummary[studentName];
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${summary.lastPaymentDate}</td>
                    <td class="student-name">${studentName}</td>
                    <td>${summary.category}</td>
                    <td>${summary.paymentCount} payments, $${summary.totalAmount.toFixed(2)}</td>
                `;
                row.querySelector('.student-name').addEventListener('click', () => showStudentPopup(studentName));
                paymentsTableBody.appendChild(row);
            });
        });
    }
}

// Load student names for the datalist
function loadStudentNames() {
    const user = firebase.auth().currentUser;
    if (user) {
        const paymentRef = firebase.database().ref('payments/' + user.uid);
        paymentRef.once('value', (snapshot) => {
            const studentNames = new Map();
            snapshot.forEach((childSnapshot) => {
                const payment = childSnapshot.val();
                studentNames.set(payment.studentName, payment.amount);
            });

            // Populate the datalist with student names
            const datalist = document.getElementById('studentNameSuggestions');
            datalist.innerHTML = '';
            studentNames.forEach((amount, name) => {
                const option = document.createElement('option');
                option.value = name;
                datalist.appendChild(option);
            });

            // Event listener to check if the student exists and suggest amount
            const studentNameInput = document.getElementById('studentName');
            const whatsappContainer = document.getElementById('whatsappContainer');
            const whatsappNumber = document.getElementById('whatsappNumber');
            const paymentAmountInput = document.getElementById('paymentAmount');
            const amountSuggestion = document.getElementById('amountSuggestion');
            const suggestedAmount = document.getElementById('suggestedAmount');

            studentNameInput.addEventListener('input', () => {
                if (studentNames.has(studentNameInput.value)) {
                    whatsappContainer.style.display = 'none';
                    whatsappNumber.removeAttribute('required'); // Remove the required attribute

                    const lastAmount = studentNames.get(studentNameInput.value);
                    suggestedAmount.textContent = lastAmount.toFixed(2);
                    amountSuggestion.style.display = 'block';
                } else {
                    whatsappContainer.style.display = 'block';
                    whatsappNumber.setAttribute('required', true); // Add the required attribute back
                    amountSuggestion.style.display = 'none';
                }
            });

            // Auto-fill the payment amount when clicking on the suggestion
            amountSuggestion.addEventListener('click', () => {
                paymentAmountInput.value = suggestedAmount.textContent;
                amountSuggestion.style.display = 'none';
            });
        });
    }
}



// Updated showStudentPopup function to handle PDF generation
function showStudentPopup(studentName) {
    const user = firebase.auth().currentUser;
    if (user) {
        const paymentRef = firebase.database().ref('payments/' + user.uid);
        paymentRef.orderByChild('studentName').equalTo(studentName).once('value', (snapshot) => {
            let paymentData = [];
            snapshot.forEach((childSnapshot) => {
                paymentData.push(childSnapshot.val());
            });

            // Display payment history in the popup
            let html = '<ul>';
            paymentData.forEach((payment) => {
                html += `<li>Date: ${payment.date}, Category: ${payment.category}, Amount: $${payment.amount.toFixed(2)}</li>`;
            });
            html += '</ul>';

            studentPaymentHistory.innerHTML = html;
            studentPopup.style.display = 'block';

            // Enable send via WhatsApp button
            const phoneNumber = paymentData[0].whatsappNumber; // Assuming all payments have the same WhatsApp number
            downloadHistoryBtn.onclick = () => generateInvoicePDFAndSendWhatsApp(studentName, paymentData, phoneNumber);
        });
    }
}

// Function to generate the invoice PDF and then trigger WhatsApp
async function generateInvoicePDFAndSendWhatsApp(studentName, paymentData, phoneNumber) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Add title
    doc.setFontSize(18);
    doc.text('Invoice', 20, 20);

    // Add student name
    doc.setFontSize(14);
    doc.text(`Student Name: ${studentName}`, 20, 30);

    // Add table headers
    doc.setFontSize(12);
    doc.text('Date', 20, 40);
    doc.text('Category', 60, 40);
    doc.text('Amount', 140, 40);

    // Add table data
    let y = 50;
    let totalAmount = 0;
    paymentData.forEach((payment) => {
        doc.text(payment.date, 20, y);
        doc.text(payment.category, 60, y);
        doc.text(`$${payment.amount.toFixed(2)}`, 140, y);
        y += 10;
        totalAmount += payment.amount;
    });

    // Add total amount
    doc.text(`Total: $${totalAmount.toFixed(2)}`, 140, y + 10);

    // Save the PDF and trigger a download
    const fileName = `Invoice_${studentName.replace(/\s+/g, '_')}.pdf`;
    doc.save(fileName);

    // Open WhatsApp with the message
    const message = `Invoice for ${studentName} has been generated.`;
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
}

// Initialize the application
function initApp() {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            authContainer.style.display = 'none';
            dashboard.style.display = 'block';
            logoutBtn.style.display = 'inline-block';
            loadUserData();
            updateBalance();
            loadPayments();
            loadStudentNames();  // Load student names for autocomplete
        } else {
            authContainer.style.display = 'block';
            dashboard.style.display = 'none';
            logoutBtn.style.display = 'none';
        }
    });

    

    // Ensure the elements exist before adding event listeners
    const studentNameInput = document.getElementById('studentName');
    if (studentNameInput) {
        studentNameInput.addEventListener('input', loadStudentNames);
    }

    // Agregar el event listener para el formulario de gastos
    const expenseForm = document.getElementById('expenseRecordForm');
    if (expenseForm) {
        expenseForm.addEventListener('submit', recordExpense);
        console.log('Event listener added to expense form');
    } else {
        console.error('Expense form not found');
    }
    

    authForm.addEventListener('submit', (e) => e.preventDefault());
    loginBtn.addEventListener('click', loginUser);
    registerBtn.addEventListener('click', registerUser);
    logoutBtn.addEventListener('click', () => firebase.auth().signOut());
    studentPaymentForm.addEventListener('submit', recordStudentPayment);
    expenseRecordForm.addEventListener('submit', recordExpense);
    closePopup.onclick = () => studentPopup.style.display = 'none';

    // Close popup when clicking outside of it
    window.onclick = (event) => {
        if (event.target == studentPopup) {
            studentPopup.style.display = 'none';
        }
    }
}

function loginUser() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    firebase.auth().signInWithEmailAndPassword(email, password)
        .catch((error) => {
            console.error('Error:', error);
            alert('Login failed. Please check your credentials.');
        });
}

function registerUser() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    firebase.auth().createUserWithEmailAndPassword(email, password)
        .catch((error) => {
            console.error('Error:', error);
            alert('Registration failed. Please try again.');
        });
}

// Ensure this function is correctly linked to the form submission
async function recordStudentPayment(e) {
    e.preventDefault();  // Prevent the default form submission behavior

    const studentName = document.getElementById('studentName').value.trim();
    const paymentCategory = document.getElementById('paymentCategory').value;
    const paymentAmount = parseFloat(document.getElementById('paymentAmount').value);
    const paymentDate = document.getElementById('paymentDate').value;
    const whatsappNumber = document.getElementById('whatsappNumber').value.trim();

    console.log('Student Name:', studentName);
    console.log('Payment Amount:', paymentAmount);
    console.log('Payment Date:', paymentDate);
    console.log('WhatsApp Number:', whatsappNumber);

    // Modify the validation to handle optional whatsappNumber when hidden
    if (!studentName || paymentAmount <= 0 || !paymentDate || 
        (whatsappContainer.style.display !== 'none' && !whatsappNumber)) {
        alert('Please enter valid payment details.');
        return;
    }

    const user = firebase.auth().currentUser;
    if (user) {
        const paymentRef = firebase.database().ref('payments/' + user.uid);
        try {
            await paymentRef.push({
                studentName: studentName,
                category: paymentCategory,
                amount: paymentAmount,
                date: paymentDate,
                whatsappNumber: whatsappNumber || 'N/A'  // Handle empty whatsappNumber
            });
            alert('Payment recorded successfully!');
            document.getElementById('studentPaymentForm').reset();
            loadUserData();
            updateBalance();
            loadPayments();
            loadStudentNames();  // Refresh student name suggestions
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to record payment. Please try again.');
        }
    }
}





async function recordExpense(e) {
    e.preventDefault();
    console.log('recordExpense function called');

    // Obtener los elementos del formulario directamente por sus etiquetas
    const formInputs = document.querySelectorAll('#expense-popup input');
    const expenseType = formInputs[0].value.trim();
    const expenseAmount = formInputs[1].value.trim();
    const expenseDate = formInputs[2].value.trim();

    console.log('Raw form values:', { expenseType, expenseAmount, expenseDate });

    if (!expenseType || !expenseAmount || !expenseDate) {
        alert('Please fill in all fields.');
        return;
    }

    const parsedAmount = parseFloat(expenseAmount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        alert('Please enter a valid positive number for the expense amount.');
        return;
    }

    console.log('Parsed expense details:', { expenseType, amount: parsedAmount, expenseDate });

    const user = firebase.auth().currentUser;
    if (user) {
        const expenseRef = firebase.database().ref('expenses/' + user.uid);
        try {
            await expenseRef.push({
                type: expenseType,
                amount: parsedAmount,
                date: expenseDate
            });
            console.log('Expense recorded successfully');
            alert('Expense recorded successfully!');
            document.getElementById('expense-popup').style.display = 'none';
            document.querySelector('#expense-popup form').reset();
            loadUserData();
            updateBalance();
        } catch (error) {
            console.error('Error recording expense:', error);
            alert('Failed to record expense. Please try again. Error: ' + error.message);
        }
    } else {
        console.error('No user is signed in');
        alert('Please sign in to record an expense.');
    }

    try {
        await expenseRef.push({
            type: expenseType,
            amount: parsedAmount,
            date: expenseDate
        });
        console.log('Expense recorded successfully');
        alert('Expense recorded successfully!');
        document.getElementById('expense-popup').style.display = 'none';
        document.querySelector('#expense-popup form').reset();
        loadUserData(); // Llamar a loadUserData aquí
        updateBalance();
    } catch (error) {
        // ... (manejo de errores existente) ...
    }
}

// Asegúrate de que esta línea esté presente en tu código
document.querySelector('#expense-popup form').addEventListener('submit', recordExpense);



function loadUserData() {
    const user = firebase.auth().currentUser;
    if (user) {
        const expenseRef = firebase.database().ref('expenses/' + user.uid);
        expenseRef.on('value', (snapshot) => {
            let html = '<ul>';
            snapshot.forEach((childSnapshot) => {
                const expense = childSnapshot.val();
                html += `<li>
                    <span>${expense.type}</span>
                    <span>$${expense.amount.toFixed(2)}</span>
                    <small>${expense.date}</small>
                </li>`;
            });
            html += '</ul>';
            const expenseListElement = document.getElementById('expenseList');
            if (expenseListElement) {
                expenseListElement.innerHTML = html;
            } else {
                console.error('Expense list element not found');
            }
        }, (error) => {
            console.error('Error loading expenses:', error);
        });

        // Load and display income and expenses chart
        const paymentRef = firebase.database().ref('payments/' + user.uid);
        Promise.all([expenseRef.once('value'), paymentRef.once('value')])
            .then(([expenseSnapshot, paymentSnapshot]) => {
                const monthlyExpenses = {};
                const monthlyIncome = {};

                expenseSnapshot.forEach((childSnapshot) => {
                    const expense = childSnapshot.val();
                    const month = new Date(expense.date).toLocaleString('default', { month: 'long' });
                    monthlyExpenses[month] = (monthlyExpenses[month] || 0) + expense.amount;
                });

                paymentSnapshot.forEach((childSnapshot) => {
                    const payment = childSnapshot.val();
                    const month = new Date(payment.date).toLocaleString('default', { month: 'long' });
                    monthlyIncome[month] = (monthlyIncome[month] || 0) + payment.amount;
                });

                updateIncomeExpenseChart(monthlyIncome, monthlyExpenses);
            });
    }
}


// Initialize the app when the window loads
window.onload = initApp;


let expenseChart;
let lastMonthlyExpenseData = {};
function updateExpenseChart(monthlyExpenses) {
    lastMonthlyExpenseData = monthlyExpenses;
    const ctx = document.getElementById('monthlyExpenseChart');
    if (!ctx) {
        console.error('Canvas element not found');
        return;
    }

    if (expenseChart) {
        expenseChart.destroy();
    }

    const chartType = window.innerWidth < 480 ? 'line' : 'bar';

    expenseChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: Object.keys(monthlyExpenses),
            datasets: [{
                label: 'Monthly Expenses',
                data: Object.values(monthlyExpenses),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            aspectRatio: 1,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Expenses ($)'
                    },
                    ticks: {
                        callback: function(value, index, values) {
                            return '$' + value;
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Month'
                    },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            },
            plugins: {
                legend: {
                    display: false,
                },
                title: {
                    display: true,
                    text: 'Monthly Expenses'
                }
            }
        }
    });
}

function loadUserData() {
    const user = firebase.auth().currentUser;
    if (user) {
        const expenseRef = firebase.database().ref('expenses/' + user.uid);
        const paymentRef = firebase.database().ref('payments/' + user.uid);
        
        Promise.all([
            expenseRef.once('value'),
            paymentRef.once('value')
        ]).then(([expenseSnapshot, paymentSnapshot]) => {
            const monthlyExpenses = {};
            const monthlyIncome = {};

            // Process expenses
            let expenseListHtml = '<ul>';
            expenseSnapshot.forEach((childSnapshot) => {
                const expense = childSnapshot.val();
                const month = new Date(expense.date).toLocaleString('default', { month: 'long' });
                monthlyExpenses[month] = (monthlyExpenses[month] || 0) + expense.amount;
                
                expenseListHtml += `<li>
                    <span>${expense.type}</span>
                    <span>$${expense.amount.toFixed(2)}</span>
                    <small>${expense.date}</small>
                </li>`;
            });
            expenseListHtml += '</ul>';

            // Update expense list
            const expenseListElement = document.getElementById('expenseList');
            if (expenseListElement) {
                expenseListElement.innerHTML = expenseListHtml;
            } else {
                console.error('Expense list element not found');
            }

            // Process payments
            paymentSnapshot.forEach((childSnapshot) => {
                const payment = childSnapshot.val();
                const month = new Date(payment.date).toLocaleString('default', { month: 'long' });
                monthlyIncome[month] = (monthlyIncome[month] || 0) + payment.amount;
            });

            // Update chart
            updateIncomeExpenseChart(monthlyIncome, monthlyExpenses);
        }).catch(error => {
            console.error('Error loading user data:', error);
            alert('There was an error loading your data. Please try refreshing the page.');
        });
    }
}



// ... (código anterior sin cambios)

// Funciones para manejar popups y botones flotantes
function showPopup(popup) {
    popup.style.display = 'block';
  }
  

  
  function toggleSubButtons() {
    recordPaymentBtn.classList.toggle('show');
    recordExpenseBtn.classList.toggle('show');
  }
  
  // Obtener elementos del DOM
  const mainActionBtn = document.getElementById('main-action-btn');
  const recordPaymentBtn = document.getElementById('record-payment-btn');
  const recordExpenseBtn = document.getElementById('record-expense-btn');
  const paymentPopup = document.getElementById('payment-popup');
  const expensePopup = document.getElementById('expense-popup');
  const studentPaymentFormPopup = document.getElementById('studentPaymentForm');
  const expenseRecordFormPopup = document.getElementById('expenseRecordForm');
  
  // Agregar event listeners
  if (mainActionBtn) mainActionBtn.addEventListener('click', toggleSubButtons);
  if (recordPaymentBtn) recordPaymentBtn.addEventListener('click', () => showPopup(paymentPopup));
  if (recordExpenseBtn) recordExpenseBtn.addEventListener('click', () => showPopup(expensePopup));
  
  // Manejar clics fuera de los popups y botones flotantes
  document.addEventListener('click', function(event) {
    if (event.target.classList.contains('popup')) {
      event.target.style.display = 'none';
      recordPaymentBtn.classList.remove('show');
      recordExpenseBtn.classList.remove('show');
    } else if (!event.target.closest('#floating-menu')) {
      recordPaymentBtn.classList.remove('show');
      recordExpenseBtn.classList.remove('show');
    }
  });
  
  // Manejar botones de cerrar en los popups
  document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.onclick = function() {
      this.closest('.popup').style.display = 'none';
    }
  });
  
  // Asegurar que los formularios dentro de los popups funcionen correctamente
  if (studentPaymentFormPopup) {
    studentPaymentFormPopup.addEventListener('submit', recordStudentPayment);
  }
  
  if (expenseRecordFormPopup) {
    expenseRecordFormPopup.addEventListener('submit', recordExpense);
  }
  
  // Evento de redimensionamiento de la ventana
  window.addEventListener('resize', function() {
    if (incomeChart) updateIncomeChart(lastMonthlyIncomeData);
    if (expenseChart) updateExpenseChart(lastMonthlyExpenseData);
  });
  
  // Inicialización de la aplicación
  window.onload = function() {
    initApp();
    loadUserData();
    // La inicialización de los botones flotantes ya está incluida en los event listeners anteriores
  };
