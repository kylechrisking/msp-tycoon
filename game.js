class Game {
    constructor() {
        // Initialize base game properties
        this.data = 0;
        this.clickValue = 1;
        this.lastUpdate = performance.now();
        this.isHoldingClick = false;
        this.clickInterval = null;
        
        // Initialize statistics
        this.statistics = {
            totalDataGenerated: 0,
            totalClicks: 0,
            peakDPS: 0,
            timeSpentPlaying: 0
        };

        // Initialize achievement bonuses
        this.achievementBonuses = {
            taskSpeed: 0,
            income: 0,
            clickValue: 0
        };

        // Initialize task-related properties
        this.taskTimers = {};
        this.hasStartedFirstTask = false;
        
        // Initialize roles with proper structure
        this.roles = {
            technician: {
                employees: {
                    tech1: { owned: false, automated: false, cost: 25, baseReward: 15, baseTaskTime: 8000 },
                    tech2: { owned: false, automated: false, cost: 250, baseReward: 75, baseTaskTime: 12000 },
                    tech3: { owned: false, automated: false, cost: 2500, baseReward: 375, baseTaskTime: 16000 }
                }
            },
            manager: {
                employees: {
                    techManager1: { owned: false, cost: 100, manages: 'tech1' },
                    techManager2: { owned: false, cost: 1000, manages: 'tech2' },
                    techManager3: { owned: false, cost: 10000, manages: 'tech3' }
                }
            }
        };

        // Initialize tutorial state
        this.tutorialState = {
            completed: false,
            currentStep: 0,
            steps: [
                {
                    message: "Welcome! Click or hold the computer button to generate data.",
                    trigger: 'start'
                },
                {
                    message: "Keep generating data! You need 25 GB to hire your first Technician.",
                    trigger: 'firstClick'
                },
                {
                    message: "Great! You can now hire a Technician. Click the 'Hire' button to get your first employee.",
                    trigger: 'canHireTech',
                    requirement: 25
                },
                {
                    message: "Technician hired! Click their progress bar to start generating data automatically.",
                    trigger: 'techHired'
                },
                {
                    message: "Your Technician is working! Keep generating data to afford a Manager (100 GB) who can automate your Technician.",
                    trigger: 'taskStarted'
                },
                {
                    message: "You can now hire a Manager! They'll make your Technician work automatically.",
                    trigger: 'canHireManager',
                    requirement: 100
                },
                {
                    message: "Manager hired! Now work towards hiring a second Technician to unlock Upgrades.",
                    trigger: 'managerHired'
                },
                {
                    message: "Upgrades unlocked! These permanent improvements will help you generate more data.",
                    trigger: 'upgradesUnlocked'
                }
            ]
        };

        // Initialize settings
        this.settings = {
            notificationDuration: 3000,
            progressAnimation: 'smooth',
            theme: 'default',
            colorScheme: 'blue'
        };

        // Initialize panels
        this.currentPanel = 'employeesPanel';
        this.initializePanelStates();

        // Initialize save-related properties
        this.autoSaveInterval = null;
        this.lastSaveTime = Date.now();

        // Initialize prestige system
        this.prestige = {
            points: 0,
            available: 0,
            threshold: 100000,
            multiplier: 0.05 // Each point = +5% data gain
        };

        // Initialize hiring options
        this.hiringOptions = [
            {
                id: 'Tech',
                cost: 100,
                baseProd: 1,
                btn: 'hireTechBtn',
                card: 'hireTechCard',
                count: 0,
                costScale: 1.15
            },
            {
                id: 'Supervisor',
                cost: 1000,
                baseProd: 10,
                btn: 'hireSupervisorBtn',
                card: 'hireSupervisorCard',
                count: 0,
                costScale: 1.18
            },
            {
                id: 'Director',
                cost: 5000,
                baseProd: 50,
                btn: 'hireDirectorBtn',
                card: 'hireDirectorCard',
                count: 0,
                costScale: 1.22
            },
            {
                id: 'RegionalManager',
                cost: 50000,
                baseProd: 500,
                btn: 'hireRegionalManagerBtn',
                card: 'hireRegionalManagerCard',
                count: 0,
                costScale: 1.25
            }
        ];
        this.totalPassiveProd = 0;

        // Initialize the game
        this.initialize();

        // Add page unload handler
        window.addEventListener('beforeunload', () => {
            this.saveGame();
        });

        this.hasShownTechTutorial = false;
    }

    initialize() {
        // First load save data
        this.loadGame();
        
        // Set up basic handlers
        this.setupClickHandlers();
        this.setupPanelHandlers();
        this.setupHireHandlers();
        this.setupEmployeeHandlers();
        this.setupUpgradeHandlers();
        this.setupSettingsHandlers();
        
        // Update display first time
        this.updateDisplay();
        
        // Set up manager handlers last (since they depend on DOM elements)
        setTimeout(() => {
            this.setupManagerHandlers();
        }, 0);
        
        // Start game systems
        this.startGameLoop();
        this.startAutoSave();
    }

    setupClickHandlers() {
        const fixButton = document.getElementById('fixComputer');
        if (fixButton) {
            fixButton.addEventListener('click', () => {
                this.data += this.clickValue;
                this.updateDisplay();
                this.saveGame();
            });
        }
    }

    handleClick() {
        const totalClickValue = Math.round(this.clickValue * (1 + this.achievementBonuses.clickValue));
        this.data += totalClickValue;
        this.statistics.totalClicks++;
        this.statistics.totalDataGenerated += totalClickValue;
        this.updateDisplay();
        
        // Check tutorial steps
        if (this.statistics.totalClicks === 1) {
            this.showNextTutorialStep('firstClick');
        }
        
        // Check if player can hire first tech
        if (!this.hasShownTechTutorial && this.data >= 25) {
            this.hasShownTechTutorial = true;
            this.showNextTutorialStep('canHireTech');
        }
    }

    updateDisplay() {
        // Update main stats
        const dataDisplay = document.getElementById('data');
        if (dataDisplay) dataDisplay.textContent = Math.floor(this.data);
        
        // Calculate total passive production
        this.totalPassiveProd = this.hiringOptions.reduce((sum, opt) => sum + opt.baseProd * opt.count, 0);
        const dpsDisplay = document.getElementById('dataPerSecond');
        if (dpsDisplay) dpsDisplay.textContent = this.totalPassiveProd;
        
        const clickValueDisplay = document.getElementById('clickValue');
        if (clickValueDisplay) clickValueDisplay.textContent = this.clickValue;
        
        // Update hiring bar UI
        this.hiringOptions.forEach(opt => {
            const card = document.getElementById(opt.card);
            const btn = document.getElementById(opt.btn);
            const cost = Math.floor(opt.cost * Math.pow(opt.costScale, opt.count));
            const prod = opt.baseProd * (opt.count + 1);
            if (card) {
                card.querySelector('.hire-cost').textContent = `${cost.toLocaleString()} Data Points`;
                card.querySelector('.hire-prod').textContent = `Generates ${opt.baseProd.toLocaleString()} Data/s`;
                let owned = card.querySelector('.hire-owned');
                if (!owned) {
                    owned = document.createElement('div');
                    owned.className = 'hire-owned';
                    owned.style = 'color:#7a8ca3;font-size:0.9rem;margin-top:0.2rem;';
                    card.appendChild(owned);
                }
                owned.textContent = `Owned: ${opt.count}`;
            }
            if (btn) {
                if (this.data >= cost) {
                    btn.classList.add('can-afford');
                    btn.disabled = false;
                } else {
                    btn.classList.remove('can-afford');
                    btn.disabled = true;
                }
            }
        });
        
        // Render IT Team panel
        this.renderITTeam();
    }

    startGameLoop() {
        setInterval(() => {
            this.data += this.totalPassiveProd / 5; // 5 times per second
            this.updateDisplay();
        }, 200);
    }

    setupPanelHandlers() {
        const navButtons = document.querySelectorAll('.nav-button');
        navButtons.forEach(button => {
            // Remove any existing click listeners
            button.removeEventListener('click', this.handlePanelClick);
            
            // Create bound handler
            this.handlePanelClick = (e) => {
                const panelId = button.getAttribute('data-panel');
                
                if (button.classList.contains('disabled')) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (panelId === 'managersPanel') {
                        this.showNotification('You need to hire at least one Technician to unlock the Managers panel');
                    } else if (panelId === 'upgradesPanel') {
                        this.showNotification('You need to hire at least two Technicians to unlock the Upgrades panel');
                    }
                    return false;
                }
                
                this.switchPanel(panelId);
            };

            // Add click listener
            button.addEventListener('click', this.handlePanelClick.bind(this));
            
            // Prevent default action on disabled buttons
            if (button.classList.contains('disabled')) {
                button.addEventListener('mousedown', (e) => e.preventDefault());
                button.addEventListener('touchstart', (e) => e.preventDefault());
            }
        });
    }

    switchPanel(panelId) {
        // Hide current panel
        document.getElementById(this.currentPanel).classList.remove('active');
        document.querySelector(`[data-panel="${this.currentPanel}"]`).classList.remove('active');
        
        // Show new panel
        document.getElementById(panelId).classList.add('active');
        document.querySelector(`[data-panel="${panelId}"]`).classList.add('active');
        
        this.currentPanel = panelId;
    }

    initializePanelStates() {
        // Initially disable managers and upgrades panels
        const managersButton = document.querySelector('[data-panel="managersPanel"]');
        const upgradesButton = document.querySelector('[data-panel="upgradesPanel"]');
        
        if (managersButton) managersButton.classList.add('disabled');
        if (upgradesButton) upgradesButton.classList.add('disabled');
    }

    handleEmployeeHire(roleName, empId) {
        const employee = this.roles[roleName].employees[empId];
        if (!employee.owned && this.data >= employee.cost) {
            this.data -= employee.cost;
            employee.owned = true;
            employee.automated = false; // Make sure automation is off by default

            // Show the active section and hide hire section
            const card = document.getElementById(`${empId}Card`);
            if (card) {
                const hireSection = card.querySelector('.hire-section');
                const activeSection = card.querySelector('.employee-active');
                
                if (hireSection && activeSection) {
                    hireSection.style.display = 'none';
                    activeSection.style.display = 'block';
                }
            }

            // Update displays
            this.updateEmployeeDisplay(roleName, empId);
            this.updateDisplay();
            
            // Show notification
            this.showNotification(`${this.getTechnicianTitle(empId)} hired!`);

            // Check for tutorial progress
            if (empId === 'tech1') {
                this.showNextTutorialStep('techHired');
            }

            // Check unlocks
            this.checkUnlocks();
        }
    }

    handleManagerHire(managerId) {
        const manager = this.roles.manager.employees[managerId];
        if (!manager.owned && this.data >= manager.cost) {
            // Purchase the manager
            this.data -= manager.cost;
            manager.owned = true;
            
            // Update UI
            const button = document.getElementById(`hire${managerId}`);
            if (button) {
                button.classList.add('owned');
                button.disabled = true;
                button.innerHTML = `
                    <div class="manager-icon">
                        <i class="fas fa-user-tie"></i>
                    </div>
                    <div class="manager-info">
                        <span class="title">${this.getManagerTitle(managerId)}</span>
                        <div class="status">
                            <i class="fas fa-check-circle"></i>
                            Managing ${this.getTechnicianTitle(manager.manages)}
                        </div>
                    </div>
                `;
            }

            // Start automation
            const targetTech = manager.manages;
            if (this.roles.technician.employees[targetTech]) {
                this.roles.technician.employees[targetTech].automated = true;
                this.automateEmployee(managerId);
            }
            
            // Update display
            this.updateDisplay();
            
            // Show notification
            this.showNotification(`${this.getManagerTitle(managerId)} hired! ${this.getTechnicianTitle(manager.manages)} is now automated.`);
            
            // Save the game
            this.saveGame();
        }
    }

    checkUnlocks() {
        const techCount = this.countOwnedEmployees('technician');
        
        // Managers panel unlock
        const managersButton = document.querySelector('[data-panel="managersPanel"]');
        if (managersButton) {
            if (techCount >= 1) {
                managersButton.classList.remove('disabled');
                if (this.data >= 100) {
                    this.showNextTutorialStep('canHireManager', this.data);
                }
            }
        }
        
        // Upgrades panel unlock
        const upgradesButton = document.querySelector('[data-panel="upgradesPanel"]');
        if (upgradesButton) {
            if (techCount >= 2) {
                upgradesButton.classList.remove('disabled');
                this.showNextTutorialStep('upgradesUnlocked');
            }
        }
    }

    countOwnedEmployees(roleName) {
        if (!this.roles[roleName]) return 0;
        return Object.values(this.roles[roleName].employees)
            .filter(emp => emp.owned).length;
    }

    updateManagerAvailability() {
        Object.entries(this.roles).forEach(([roleName, role]) => {
            Object.entries(role.employees).forEach(([empId, employee]) => {
                if (employee.owned && !employee.automated) {
                    const managerCard = document.querySelector(`#${empId}Manager`);
                    if (managerCard) {
                        managerCard.classList.remove('hidden');
                    }
                }
            });
        });
    }

    calculateDataPerSecond() {
        let dps = 0;
        
        // Calculate DPS from technicians
        Object.entries(this.roles.technician.employees).forEach(([techId, tech]) => {
            if (tech.owned) {
                const baseReward = tech.baseReward;
                const taskTime = tech.baseTaskTime / 1000; // Convert to seconds
                const rewardPerSecond = baseReward / taskTime;
                dps += rewardPerSecond;
            }
        });
        
        // Apply prestige multiplier
        dps *= (1 + this.prestige.points * this.prestige.multiplier);
        
        // Apply income bonus if any
        if (this.achievementBonuses.income) {
            dps *= (1 + this.achievementBonuses.income);
        }
        
        return Math.round(dps * 10) / 10; // Round to 1 decimal place
    }

    updateEmployeeDisplay(roleName, empId) {
        const card = document.getElementById(`${empId}Card`);
        if (!card) return;

        const employee = this.roles[roleName].employees[empId];
        const hireSection = card.querySelector('.hire-section');
        const activeSection = card.querySelector('.employee-active');

        if (employee.owned) {
            if (hireSection) hireSection.style.display = 'none';
            if (activeSection) {
                activeSection.style.display = 'block';
                const progressBar = activeSection.querySelector('.progress-bar');
                if (progressBar) {
                    progressBar.setAttribute('data-employee', empId);
                    // Remove old click listener
                    progressBar.onclick = null;
                    // Add new click listener
                    progressBar.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (employee.owned) {
                            this.startTask('technician', empId);
                        }
                    };
                }
            }
        } else {
            if (hireSection) hireSection.style.display = 'block';
            if (activeSection) activeSection.style.display = 'none';
        }
    }

    showNotification(message, type = 'default') {
        const notification = document.getElementById('notification');
        const notificationText = document.getElementById('notificationText');
        const notificationIcon = notification.querySelector('i');
        
        if (!notification || !notificationText) return;

        // Remove any existing click handlers
        notification.onclick = null;

        if (type === 'tutorial') {
            notificationIcon.className = 'fas fa-graduation-cap';
            notification.classList.add('tutorial');
            notification.classList.remove('achievement');
            notification.style.cursor = 'default';
        } else if (type === 'achievement') {
            notificationIcon.className = 'fas fa-trophy';
            notification.classList.add('achievement');
            notification.classList.remove('tutorial');
            notification.style.cursor = 'pointer';
            notification.onclick = (e) => {
                e.stopPropagation();
                this.switchPanel('achievementsPanel');
                notification.style.opacity = '0';
                setTimeout(() => {
                    notification.style.display = 'none';
                    notification.style.opacity = '1';
                }, 300);
            };
        } else {
            notificationIcon.className = 'fas fa-info-circle';
            notification.classList.remove('tutorial', 'achievement');
            notification.style.cursor = 'default';
        }

        notificationText.textContent = message;
        notification.style.display = 'block';
        notification.style.opacity = '1';
        
        const duration = type === 'tutorial' ? 5000 : 3000;
        
        if (this.notificationTimeout) {
            clearTimeout(this.notificationTimeout);
        }
        
        // Don't auto-hide achievement notifications
        if (type !== 'achievement') {
            this.notificationTimeout = setTimeout(() => {
                notification.style.opacity = '0';
                setTimeout(() => {
                    notification.style.display = 'none';
                    notification.style.opacity = '1';
                }, 300);
            }, duration);
        }
    }

    setupHireHandlers() {
        this.hiringOptions.forEach(opt => {
            const btn = document.getElementById(opt.btn);
            if (btn) {
                btn.addEventListener('click', () => {
                    const cost = Math.floor(opt.cost * Math.pow(opt.costScale, opt.count));
                    if (this.data >= cost) {
                        this.data -= cost;
                        opt.count++;
                        this.updateDisplay();
                        this.saveGame();
                    }
                });
            }
        });
    }

    areAllEmployeesAutomated(roleName) {
        if (!this.roles[roleName]) return false;
        const employees = Object.values(this.roles[roleName].employees);
        return employees.length > 0 && employees.every(emp => emp.owned && emp.automated);
    }

    automateEmployee(managerId) {
        const manager = this.roles.manager.employees[managerId];
        const targetTech = manager.manages;
        const employee = this.roles.technician.employees[targetTech];
        
        if (!employee || !employee.owned) {
            console.error('Target employee not found or not owned:', targetTech);
            return;
        }

        // Mark the employee as automated
        employee.automated = true;
        
        // Update the progress bar appearance
        const progressBar = document.querySelector(`#${targetTech}Card .progress-bar`);
        if (progressBar) {
            progressBar.classList.add('automated');
            const progressText = progressBar.querySelector('.progress-text');
            if (progressText) {
                progressText.textContent = 'Automated';
            }
        }
        
        // Start the automation loop
        this.startTask('technician', targetTech);
    }

    setupSettingsHandlers() {
        // Dark mode toggle
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            themeBtn.addEventListener('click', () => {
                const isDark = document.body.getAttribute('data-theme') === 'dark';
                document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
                this.saveGame();
            });
        }
        // Clear Save button
        let clearBtn = document.getElementById('clearSave');
        if (!clearBtn) {
            clearBtn = document.createElement('button');
            clearBtn.id = 'clearSave';
            clearBtn.className = 'button';
            clearBtn.innerHTML = '<i class="fas fa-trash"></i> Clear Save';
            const settingsGrid = document.querySelector('.settings-grid .setting-buttons');
            if (settingsGrid) settingsGrid.appendChild(clearBtn);
        }
        clearBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear your save? This cannot be undone.')) {
                localStorage.removeItem('itEmpireSave');
                location.reload();
            }
        });
    }

    resetGame() {
        // Clear all local storage
        localStorage.removeItem('gameState');
        localStorage.removeItem('tutorialState');
        localStorage.removeItem('itEmpireSave');
        
        // Clear all intervals
        Object.keys(this.taskTimers).forEach(timer => {
            clearInterval(this.taskTimers[timer]);
        });
        
        // Clear auto-save interval
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        // Reload the page to start fresh
        window.location.reload();
    }

    // Clean up method to prevent memory leaks
    cleanup() {
        this.stopAutoClick();
        
        // Clear auto-save interval
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
    }

    countTotalEmployees() {
        let total = 0;
        Object.values(this.roles).forEach(role => {
            total += Object.values(role.employees).filter(emp => emp.owned).length;
        });
        return total;
    }

    // Add method to stop auto-clicking
    stopAutoClick() {
        if (this.holdIntervalId) {
            clearInterval(this.holdIntervalId);
            this.holdIntervalId = null;
        }
    }

    // Add this method to test notifications
    testNotification() {
        this.showNotification('Test notification');
    }

    startAutoSave() {
        // Save every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            this.saveGame();
        }, 30000);
    }

    saveGame() {
        const saveData = {
            data: this.data,
            clickValue: this.clickValue,
            hiringOptions: this.hiringOptions.map(opt => ({ id: opt.id, count: opt.count })),
            theme: document.body.getAttribute('data-theme') || 'light'
        };
        localStorage.setItem('itEmpireSave', JSON.stringify(saveData));
    }

    loadGame() {
        const saved = localStorage.getItem('itEmpireSave');
        if (saved) {
            try {
                const saveData = JSON.parse(saved);
                this.data = saveData.data || 0;
                this.clickValue = saveData.clickValue || 1;
                if (saveData.hiringOptions) {
                    saveData.hiringOptions.forEach(savedOpt => {
                        const opt = this.hiringOptions.find(o => o.id === savedOpt.id);
                        if (opt) opt.count = savedOpt.count;
                    });
                }
                if (saveData.theme) {
                    document.body.setAttribute('data-theme', saveData.theme);
                }
            } catch (e) {
                // Ignore errors, start fresh
            }
        }
    }

    loadTutorialState() {
        const savedState = localStorage.getItem('tutorialState');
        if (savedState) {
            this.tutorialState.completed = JSON.parse(savedState).completed;
            this.tutorialState.currentStep = JSON.parse(savedState).currentStep;
        } else {
            this.showNextTutorialStep('start');
        }
    }

    saveTutorialState() {
        localStorage.setItem('tutorialState', JSON.stringify({
            completed: this.tutorialState.completed,
            currentStep: this.tutorialState.currentStep
        }));
    }

    showNextTutorialStep(trigger, value = null) {
        if (this.tutorialState.completed) return;

        const currentStep = this.tutorialState.steps[this.tutorialState.currentStep];
        if (!currentStep) {
            this.tutorialState.completed = true;
            this.saveTutorialState();
            return;
        }

        if (currentStep.trigger === trigger) {
            if (currentStep.requirement && value < currentStep.requirement) {
                return;
            }

            this.showNotification(currentStep.message, 'tutorial');
            this.tutorialState.currentStep++;
            this.saveTutorialState();
        }
    }

    startTask(roleName, empId) {
        console.log('Starting task for:', empId);
        const employee = this.roles[roleName].employees[empId];
        if (!employee || !employee.owned) return;

        // Don't start a new task if one is already in progress
        if (this.taskTimers[empId]) return;

        const progressBar = document.querySelector(`#${empId}Card .progress-bar`);
        const progressFill = progressBar?.querySelector('.progress-fill');
        const progressText = progressBar?.querySelector('.progress-text');
        
        if (!progressBar || !progressFill || !progressText) {
            console.error('Progress elements not found for:', empId);
            return;
        }

        let progress = 0;
        const taskTime = this.calculateTaskTime(employee.baseTaskTime);
        const updateInterval = 50; // More frequent updates for smoother animation

        progressFill.style.width = '0%';
        progressText.textContent = employee.automated ? 'Automated' : 'Working...';

        // Clear any existing timer
        if (this.taskTimers[empId]) {
            clearInterval(this.taskTimers[empId]);
        }

        this.taskTimers[empId] = setInterval(() => {
            progress += (updateInterval / taskTime) * 100;
            
            if (progress >= 100) {
                this.completeTask(roleName, empId);
                progress = 0;
                progressFill.style.width = '0%';
                
                // If not automated, clear the timer and reset text
                if (!employee.automated) {
                    clearInterval(this.taskTimers[empId]);
                    this.taskTimers[empId] = null;
                    progressText.textContent = 'Click to start task';
                }
            } else {
                progressFill.style.width = `${progress}%`;
            }
        }, updateInterval);
    }

    calculateTaskTime(baseTime) {
        return baseTime * (1 - (this.achievementBonuses.taskSpeed || 0));
    }

    completeTask(roleName, empId) {
        const employee = this.roles[roleName].employees[empId];
        if (!employee || !employee.owned) return;

        // Calculate reward with bonuses
        let reward = employee.baseReward;
        if (this.achievementBonuses.income) {
            reward *= (1 + this.achievementBonuses.income);
        }

        // Apply efficiency bonus (chance for double reward)
        if (this.achievementBonuses.efficiency && Math.random() < this.achievementBonuses.efficiency) {
            reward *= 2;
        }

        // Add the reward
        reward = Math.round(reward);
        this.data += reward;
        this.statistics.totalDataGenerated += reward;

        // Update display
        this.updateDisplay();
    }

    setupEmployeeHandlers() {
        Object.entries(this.roles.technician.employees).forEach(([empId, employee]) => {
            const progressBar = document.querySelector(`#${empId}Card .progress-bar`);
            if (progressBar) {
                progressBar.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (employee.owned && !employee.automated) {
                        console.log('Progress bar clicked for:', empId);
                        this.startTask('technician', empId);
                    }
                };
            }
        });
    }

    applyAchievementReward(type, amount) {
        switch (type.toLowerCase()) {  // Convert to lowercase for case-insensitive comparison
            case 'taskspeed':
            case 'task speed':  // Handle both formats
                this.achievementBonuses.taskSpeed += amount;
                break;
            case 'income':
                this.achievementBonuses.income += amount;
                break;
            case 'clickvalue':
            case 'click value':  // Handle both formats
                this.achievementBonuses.clickValue += amount;
                break;
            default:
                console.warn('Unknown achievement reward type:', type);
        }
        
        // Update display after applying reward
        this.updateDisplay();
    }

    updateAchievementCounts() {
        const totalAchievements = document.getElementById('totalAchievements');
        const achievementCount = document.getElementById('achievementCount');
        const completionText = document.querySelector('.completion-text');
        const completionFill = document.querySelector('.completion-fill');

        if (totalAchievements && achievementCount && completionText && completionFill) {
            const total = AchievementSystem.getTotalAchievements();
            const completed = AchievementSystem.getCompletedAchievements();
            const percentage = Math.round((completed / total) * 100);

            totalAchievements.textContent = total;
            achievementCount.textContent = completed;
            completionText.textContent = `${percentage}% Complete`;
            completionFill.style.width = `${percentage}%`;
        }
    }

    setupManagerHandlers() {
        // Create a mapping of manager IDs to their display names and costs
        const managerConfig = {
            'techManager1': { title: 'Junior Tech Manager', cost: 100, manages: 'tech1' },
            'techManager2': { title: 'Tech Manager', cost: 1000, manages: 'tech2' },
            'techManager3': { title: 'Senior Tech Manager', cost: 10000, manages: 'tech3' }
        };

        // Wait for DOM to be ready
        const initializeManagers = () => {
            Object.entries(managerConfig).forEach(([managerId, config]) => {
                const button = document.getElementById(`hire${managerId}`);
                if (!button) {
                    // Instead of logging an error, try again later if button not found
                    setTimeout(initializeManagers, 100);
                    return;
                }

                // Remove any existing listeners
                const newButton = button.cloneNode(true);
                button.parentNode.replaceChild(newButton, button);

                // Update button state if manager is owned
                const manager = this.roles.manager.employees[managerId];
                if (manager && manager.owned) {
                    newButton.classList.add('owned');
                    newButton.disabled = true;
                    newButton.innerHTML = `
                        <div class="manager-icon">
                            <i class="fas fa-user-tie"></i>
                        </div>
                        <div class="manager-info">
                            <span class="title">${this.getManagerTitle(managerId)}</span>
                            <div class="status">
                                <i class="fas fa-check-circle"></i>
                                Managing ${this.getTechnicianTitle(manager.manages)}
                            </div>
                        </div>
                    `;
                }

                newButton.addEventListener('click', () => {
                    if (this.data >= manager.cost && !manager.owned) {
                        this.handleManagerHire(managerId);
                    }
                });
            });
        };

        // Start the initialization process
        initializeManagers();
    }

    getManagerTitle(managerId) {
        const titles = {
            techManager1: 'Junior Tech Manager',
            techManager2: 'Tech Manager',
            techManager3: 'Senior Tech Manager'
        };
        return titles[managerId] || 'Manager';
    }

    restoreAutomatedTasks() {
        Object.keys(this.roles).forEach(roleName => {
            Object.keys(this.roles[roleName].employees).forEach(empId => {
                const employee = this.roles[roleName].employees[empId];
                if (employee.owned && employee.automated) {
                    this.startTask(roleName, empId);
                }
            });
        });
    }

    updateManagerDisplay(managerId) {
        const card = document.getElementById(`${managerId}Card`);
        if (!card) return;

        const manager = this.roles.manager.employees[managerId];
        const button = card.querySelector('.manager-button');
        
        if (manager.owned) {
            button.classList.add('owned');
            button.disabled = true;
            button.innerHTML = `
                <i class="fas fa-user-tie"></i>
                <span class="title">Junior Manager</span>
                <span class="description">Managing Technician</span>
                <span class="status">Active</span>
            `;
        }
    }

    // Add this new method to update all employee displays
    updateAllEmployeeDisplays() {
        Object.keys(this.roles).forEach(roleName => {
            Object.keys(this.roles[roleName].employees).forEach(empId => {
                if (this.roles[roleName].employees[empId].owned) {
                    this.updateEmployeeDisplay(roleName, empId);
                }
            });
        });
    }

    // Add new method to update automation status
    updateEmployeeAutomationStatus(empId) {
        const employeeCard = document.getElementById(`${empId}Card`);
        if (!employeeCard) return;

        const progressBar = employeeCard.querySelector('.progress-bar');
        const employeeInfo = employeeCard.querySelector('.employee-info');
        
        if (progressBar && employeeInfo) {
            // Remove any existing automation status
            const existingStatus = employeeInfo.querySelector('.automation-status');
            if (existingStatus) {
                existingStatus.remove();
            }

            // Add automated class for styling
            progressBar.classList.add('automated');
            
            // Add automation indicator
            const automationStatus = document.createElement('div');
            automationStatus.className = 'automation-status';
            automationStatus.innerHTML = '<i class="fas fa-cog fa-spin"></i> Automated';
            employeeInfo.appendChild(automationStatus);
        }
    }

    updateTechnicianButtons() {
        Object.entries(this.roles.technician.employees).forEach(([techId, tech]) => {
            const button = document.getElementById(`hire${techId.charAt(0).toUpperCase() + techId.slice(1)}`);
            if (button) {
                // Enable/disable based on cost
                button.disabled = this.data < tech.cost || tech.owned;
                
                // Update button appearance based on affordability
                if (this.data >= tech.cost && !tech.owned) {
                    button.classList.add('affordable');
                } else {
                    button.classList.remove('affordable');
                }
            }
        });
    }

    getTechnicianTitle(techId) {
        const titles = {
            tech1: 'Technician I',
            tech2: 'Technician II',
            tech3: 'Technician III'
        };
        return titles[techId] || 'Technician';
    }

    handleUpgradePurchase(upgradeId) {
        const upgradeButton = document.getElementById(upgradeId);
        if (!upgradeButton) return;

        const costElement = upgradeButton.querySelector('.cost');
        if (!costElement) return;

        const cost = parseInt(costElement.textContent);
        if (isNaN(cost) || this.data < cost) return;

        this.data -= cost;
        
        // Apply the upgrade effect based on the ID
        switch (upgradeId) {
            case 'taskSpeedUpgrade':
                this.achievementBonuses.taskSpeed += 0.1; // 10% faster tasks
                break;
            case 'revenueUpgrade':
                this.achievementBonuses.income += 0.25; // 25% more income
                break;
            case 'automationUpgrade':
                this.achievementBonuses.automation += 0.2; // 20% faster automation
                break;
            case 'efficiencyUpgrade':
                this.achievementBonuses.efficiency += 0.25; // 25% double reward chance
                break;
        }

        // Update the level display
        const levelSpan = upgradeButton.querySelector(`#${upgradeId}Level`);
        if (levelSpan) {
            const currentLevel = parseInt(levelSpan.textContent) || 0;
            levelSpan.textContent = currentLevel + 1;
        }

        // Update cost for next level
        const newCost = Math.round(cost * 1.5);
        costElement.textContent = `${newCost} GB`;

        // Update game display
        this.updateDisplay();
        this.saveGame();
    }

    setupUpgradeHandlers() {
        const upgradeButtons = [
            'taskSpeedUpgrade',
            'revenueUpgrade',
            'automationUpgrade',
            'efficiencyUpgrade'
        ];

        upgradeButtons.forEach(upgradeId => {
            const button = document.getElementById(upgradeId);
            if (button) {
                button.addEventListener('click', () => this.handleUpgradePurchase(upgradeId));
            }
        });
    }

    prestigeReset() {
        if (this.prestige.available > 0) {
            this.prestige.points += this.prestige.available;
            this.data = 0;
            this.clickValue = 1;
            // Reset employees and upgrades
            Object.values(this.roles.technician.employees).forEach(emp => { emp.owned = false; emp.automated = false; });
            this.achievementBonuses = {};
            this.prestige.available = 0;
            this.updateDisplay();
        }
    }

    setupHiringBar() {
        this.hiringOptions.forEach(opt => {
            const btn = document.getElementById(opt.btn);
            if (btn) {
                btn.addEventListener('click', () => {
                    const cost = Math.floor(opt.cost * Math.pow(opt.costScale, opt.count));
                    if (this.data >= cost) {
                        this.data -= cost;
                        opt.count++;
                        this.updateDisplay();
                        this.saveGame();
                    }
                });
            }
        });
    }

    renderITTeam() {
        const teamPanel = document.querySelector('#employeesPanel .employee-grid');
        if (!teamPanel) return;
        teamPanel.innerHTML = '';
        let hasAny = false;
        this.hiringOptions.forEach(opt => {
            if (opt.count > 0) {
                hasAny = true;
                const emp = document.createElement('div');
                emp.className = 'employee-icon';
                emp.title = opt.id;
                emp.style = 'display:inline-block;margin:0.2rem;';
                emp.innerHTML = `<i class="fas fa-user-tie" style="color:#3399ff;font-size:1.6rem;"></i><div style="font-size:0.8rem;color:#7a8ca3;text-align:center;">${opt.id} x${opt.count}</div>`;
                teamPanel.appendChild(emp);
            }
        });
        if (!hasAny) {
            teamPanel.innerHTML = '<div style="color:#7a8ca3;font-size:1.1rem;text-align:center;">No employees hired yet.</div>';
        }
    }
}

// Create game instance when document is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
    // Fix Computer button functionality
    const fixBtn = document.getElementById('fixComputer');
    if (fixBtn) {
        fixBtn.addEventListener('click', () => {
            // Default click value is 1, can be replaced with game logic
            let value = 1;
            const valueSpan = document.getElementById('clickValue');
            if (valueSpan) {
                value = parseInt(valueSpan.textContent) || 1;
            }
            const dataSpan = document.getElementById('data');
            let data = parseInt(dataSpan.textContent) || 0;
            data += value;
            dataSpan.textContent = data;
        });
    }
    // Dark Mode toggle functionality
    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isDark = document.body.getAttribute('data-theme') === 'dark';
            document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
        });
    }
    setupHiringBar();
    // Refresh the hiring bar only. Passive income belongs to
    // Game.startGameLoop(), which owns this.data.
    //
    // This interval used to add passive income as well, and it corrupted the
    // counter every tick. It sits in a top-level arrow function, so `this` is
    // window rather than the Game instance: this.totalPassiveProd read as
    // undefined, `data += undefined` produced NaN, and Math.floor(NaN) was
    // written straight into #data five times a second. It also round-tripped
    // the score through the DOM -- parsing the display text back into a
    // number -- while startGameLoop was writing the real value to the same
    // element, so the two fought over every frame.
    setInterval(() => {
        updateHiringBar();
    }, 200);
    updateHiringBar();
}); 