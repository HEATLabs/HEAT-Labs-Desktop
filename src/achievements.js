const fs = require('fs');
const path = require('path');
const {
    app
} = require('electron');

class AchievementManager {
    constructor() {
        this.achievements = [];
        this.steamClient = null;
        this.statsFilePath = path.join(app.getPath('userData'), 'achievements.json');
        this.achievementsConfigPath = path.join(__dirname, '../config/achievements.json');
        this.initialized = false;
        this.totalPlayTime = 0;
        this.lastUpdateTime = Date.now();
        this.updateInterval = null;
        this.stats = {
            totalPlayTime: 0,
            unlockedAchievements: new Set(),
            visitedPages: new Set(),
            lastSessionStart: Date.now()
        };
        this.isSteamRunning = false;
        this.pageVisitCallbacks = [];
    }

    async initialize() {
        try {
            console.log('Initializing Achievement Manager...');

            // Load achievements configuration
            this.loadAchievementsConfig();

            // Load saved stats
            this.loadStats();

            // Initialize Steamworks if available
            await this.initializeSteamworks();

            // Start playtime tracking
            this.startPlaytimeTracking();

            this.initialized = true;
            console.log('Achievement Manager initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize Achievement Manager:', error);
            return false;
        }
    }

    loadAchievementsConfig() {
        try {
            if (!fs.existsSync(this.achievementsConfigPath)) {
                console.error('Achievements config file not found at:', this.achievementsConfigPath);
                this.achievements = this.getDefaultAchievements();
                return;
            }

            const configData = fs.readFileSync(this.achievementsConfigPath, 'utf8');
            const config = JSON.parse(configData);
            this.achievements = config.achievements.map(ach => ({
                ...ach,
                unlocked: false
            }));

            console.log(`Loaded ${this.achievements.length} achievements from config`);

            this.achievements.forEach(achievement => {
                console.log(`Achievement ID ${achievement.id}: ${achievement.steamApiName} - Requirement: ${achievement.requirement}`);
            });
        } catch (error) {
            console.error('Failed to load achievements config:', error);
            this.achievements = this.getDefaultAchievements();
        }
    }

    getDefaultAchievements() {
        return [{
                id: 1,
                steamApiName: 'PLAYTIME_10_MINUTE',
                name: 'H - First Steps',
                task: 'Use HEAT Labs for 10 minutes',
                requirement: 600,
                type: 'playtime',
                unlocked: false
            },
            {
                id: 2,
                steamApiName: 'PLAYTIME_30_MINUTE',
                name: 'E - Getting Into It',
                task: 'Use HEAT Labs for 30 minutes',
                requirement: 1800,
                type: 'playtime',
                unlocked: false
            },
            {
                id: 3,
                steamApiName: 'PLAYTIME_01_HOUR',
                name: 'A - Settling In',
                task: 'Use HEAT Labs for 1 hour',
                requirement: 3600,
                type: 'playtime',
                unlocked: false
            },
            {
                id: 4,
                steamApiName: 'PLAYTIME_02_HOUR',
                name: 'T - Dedicated Player',
                task: 'Use HEAT Labs for 2 hours',
                requirement: 7200,
                type: 'playtime',
                unlocked: false
            },
            {
                id: 5,
                steamApiName: 'PLAYTIME_05_HOUR',
                name: 'L - Committed',
                task: 'Use HEAT Labs for 5 hours',
                requirement: 18000,
                type: 'playtime',
                unlocked: false
            },
            {
                id: 6,
                steamApiName: 'PLAYTIME_10_HOUR',
                name: 'A - Veteran',
                task: 'Use HEAT Labs for 10 hours',
                requirement: 36000,
                type: 'playtime',
                unlocked: false
            },
            {
                id: 7,
                steamApiName: 'PLAYTIME_25_HOUR',
                name: 'B - Hardcore',
                task: 'Use HEAT Labs for 25 hours',
                requirement: 90000,
                type: 'playtime',
                unlocked: false
            },
            {
                id: 8,
                steamApiName: 'PLAYTIME_50_HOUR',
                name: 'S - Addicted',
                task: 'Use HEAT Labs for 50 hours',
                requirement: 180000,
                type: 'playtime',
                unlocked: false
            }
        ];
    }

    async initializeSteamworks() {
        try {
            console.log('Attempting to initialize Steamworks...');

            // Check if we're on a supported platform
            if (process.platform === 'win32' || process.platform === 'darwin' || process.platform === 'linux') {
                // Try to load steamworks.js
                const steamworks = require('steamworks.js');

                console.log('Steamworks.js loaded, initializing client...');

                // Initialize Steam client
                this.steamClient = steamworks.init(4318510);

                if (this.steamClient) {
                    console.log('Steamworks initialized successfully');
                    this.isSteamRunning = true;

                    // Load achievements from Steam
                    await this.loadSteamAchievements();

                    return true;
                } else {
                    console.log('Steam client is null - Steam might not be running');
                    return false;
                }
            }

            console.log('Platform not supported for Steamworks or not running in Steam');
            return false;
        } catch (error) {
            console.log('Steamworks initialization failed (expected when not running in Steam):', error.message);
            return false;
        }
    }

    async loadSteamAchievements() {
        if (!this.steamClient || !this.isSteamRunning) {
            console.log('Skipping Steam achievements load - Steam not running');
            return;
        }

        try {
            console.log('Loading achievements from Steam...');

            // Get all achievements from Steam
            const steamAchievements = this.steamClient.achievement.getAllAchievements();

            console.log(`Found ${steamAchievements.length} achievements in Steam`);

            // Sync with our local achievements
            this.achievements.forEach(achievement => {
                const steamAchievement = steamAchievements.find(a => a.apiName === achievement.steamApiName);
                if (steamAchievement) {
                    achievement.unlocked = steamAchievement.unlocked;

                    // If unlocked in Steam, add to our local unlocked set
                    if (achievement.unlocked) {
                        this.stats.unlockedAchievements.add(achievement.id);

                        // If its a visitpage achievement, add to visited pages
                        if (achievement.type === 'visitpage') {
                            this.stats.visitedPages.add(achievement.requirement);
                        }

                        console.log(`Achievement already unlocked in Steam: ${achievement.name} (ID: ${achievement.id})`);
                    }
                } else {
                    console.warn(`Achievement not found in Steam: ${achievement.steamApiName} (ID: ${achievement.id})`);
                }
            });

            console.log('Steam achievements loaded and synced');
        } catch (error) {
            console.error('Failed to load Steam achievements:', error);
        }
    }

    loadStats() {
        try {
            if (fs.existsSync(this.statsFilePath)) {
                const savedStats = JSON.parse(fs.readFileSync(this.statsFilePath, 'utf8'));
                this.stats.totalPlayTime = savedStats.totalPlayTime || 0;
                this.stats.unlockedAchievements = new Set(savedStats.unlockedAchievements || []);
                this.stats.visitedPages = new Set(savedStats.visitedPages || []);
                this.stats.lastSessionStart = savedStats.lastSessionStart || Date.now();

                console.log(`Loaded stats: ${this.stats.totalPlayTime}s playtime, ${this.stats.unlockedAchievements.size} achievements unlocked, ${this.stats.visitedPages.size} pages visited`);

                this.achievements.forEach(achievement => {
                    if (this.stats.unlockedAchievements.has(achievement.id)) {
                        achievement.unlocked = true;
                        console.log(`Achievement ID ${achievement.id} already unlocked in local stats: ${achievement.name}`);
                    }
                });

                // Check if visited pages should unlock achievements
                this.checkExistingVisitedPages();

            } else {
                console.log('No saved stats found, starting fresh');
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    checkExistingVisitedPages() {
        // Check all visited pages from saved stats and unlock corresponding achievements
        this.stats.visitedPages.forEach(requirement => {
            console.log(`Checking visited page from saved stats: ${requirement}`);

            // Find the achievement for this requirement
            this.achievements.forEach(achievement => {
                if (achievement.type === 'visitpage' &&
                    achievement.requirement === requirement &&
                    !achievement.unlocked) {

                    console.log(`Found ununlocked achievement for requirement ${requirement}: ${achievement.name} (ID: ${achievement.id})`);

                    // Mark as unlocked locally
                    achievement.unlocked = true;
                    this.stats.unlockedAchievements.add(achievement.id);

                    // Also unlock in Steam if available
                    if (this.steamClient && this.isSteamRunning) {
                        console.log(`Attempting to unlock in Steam from saved stats: ${achievement.steamApiName}`);
                        this.unlockAchievementInSteam(achievement.steamApiName).catch(error => {
                            console.error(`Failed to unlock achievement in Steam: ${error.message}`);
                        });
                    }
                }
            });
        });
    }

    async unlockAchievementInSteam(steamApiName) {
        if (!this.steamClient || !this.isSteamRunning) {
            console.log(`Steam not running, skipping unlock for: ${steamApiName}`);
            return false;
        }

        try {
            console.log(`Unlocking achievement in Steam: ${steamApiName}`);
            await this.steamClient.achievement.activate(steamApiName);
            console.log(`Successfully unlocked in Steam: ${steamApiName}`);
            return true;
        } catch (steamError) {
            console.error(`Failed to unlock achievement in Steam: ${steamError.message}`);
            return false;
        }
    }

    saveStats() {
        try {
            const statsToSave = {
                totalPlayTime: this.stats.totalPlayTime,
                unlockedAchievements: Array.from(this.stats.unlockedAchievements),
                visitedPages: Array.from(this.stats.visitedPages),
                lastSessionStart: this.stats.lastSessionStart,
                lastSaveTime: Date.now()
            };

            fs.writeFileSync(this.statsFilePath, JSON.stringify(statsToSave, null, 2));
            console.log(`Stats saved: ${statsToSave.unlockedAchievements.length} achievements unlocked`);
        } catch (error) {
            console.error('Failed to save stats:', error);
        }
    }

    startPlaytimeTracking() {
        console.log('Starting playtime tracking...');

        // Update playtime every minute
        this.updateInterval = setInterval(() => {
            this.updatePlaytime();
        }, 60000); // Update every minute

        // Initial update
        this.updatePlaytime();

        // Save stats periodically (every 5 minutes)
        setInterval(() => {
            this.saveStats();
        }, 300000);

        // Save stats on app exit
        app.on('before-quit', () => {
            console.log('App quitting, saving achievement stats...');
            this.updatePlaytime(true);
            this.saveStats();
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
        });

        console.log('Playtime tracking started');
    }

    updatePlaytime(isExiting = false) {
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - this.lastUpdateTime) / 1000);

        if (elapsedSeconds > 0) {
            this.stats.totalPlayTime += elapsedSeconds;
            this.lastUpdateTime = now;

            // Check for achievement unlocks
            this.checkPlaytimeAchievements();
        }

        if (isExiting) {
            this.saveStats();
        }
    }

    checkPlaytimeAchievements() {
        const totalMinutes = Math.floor(this.stats.totalPlayTime / 60);
        const totalHours = totalMinutes / 60;

        console.log(`Current playtime: ${totalMinutes} minutes (${totalHours.toFixed(2)} hours)`);

        this.achievements.forEach(achievement => {
            if (!achievement.unlocked && achievement.type === 'playtime') {
                const requiredMinutes = achievement.requirement / 60; // Convert seconds to minutes

                if (totalMinutes >= requiredMinutes) {
                    console.log(`Playtime threshold reached for: ${achievement.name} (${requiredMinutes} minutes)`);
                    this.unlockAchievement(achievement.id);
                }
            }
        });
    }

    // New method to track page visits
    trackPageVisit(pageTitle) {
        if (!pageTitle) return;

        console.log(`Page title updated: "${pageTitle}"`);

        // Clean the page title to match our achievement requirements
        const cleanTitle = pageTitle.replace(/ - HEAT Labs$/i, '').trim();

        // Map page titles to achievement requirements
        const pageToRequirementMap = {
            'Official Blog': 'visit_official_blog',
            'Common Builds': 'visit_common_builds',
            'Tank Statistics': 'visit_tank_statistics',
            'Player Statistics': 'visit_player_statistics',
            'Map Knowledge': 'visit_map_knowledge',
            'Community Guides': 'visit_community_guides',
            'Playground': 'visit_playground',
            'Game News': 'visit_game_news',
            'Asset Gallery': 'visit_asset_gallery',
            'Tournaments': 'visit_tournaments',
            'About the Project': 'visit_about_the_project'
        };

        const requirement = pageToRequirementMap[cleanTitle];

        if (!requirement) {
            console.log(`No achievement requirement found for page: "${cleanTitle}"`);
            return false;
        }

        console.log(`Page "${cleanTitle}" maps to requirement: "${requirement}"`);

        if (!this.stats.visitedPages.has(requirement)) {
            console.log(`First visit to page: ${cleanTitle} (requirement: ${requirement})`);
            this.stats.visitedPages.add(requirement);

            // Check for corresponding achievements
            this.checkPageVisitAchievements(requirement);

            // Save stats
            this.saveStats();

            return true;
        } else {
            console.log(`Page already visited: ${cleanTitle} (requirement: ${requirement})`);
        }

        return false;
    }

    checkPageVisitAchievements(requirement) {
        console.log(`Checking achievements for requirement: ${requirement}`);

        this.achievements.forEach(achievement => {
            if (!achievement.unlocked &&
                achievement.type === 'visitpage' &&
                achievement.requirement === requirement) {

                console.log(`Page visit requirement met for: ${achievement.name} (ID: ${achievement.id}, Steam: ${achievement.steamApiName})`);
                this.unlockAchievement(achievement.id);
            }
        });
    }

    async unlockAchievement(achievementId) {
        const achievement = this.achievements.find(a => a.id === achievementId);

        if (!achievement) {
            console.error(`Achievement not found: ID ${achievementId}`);
            return;
        }

        if (achievement.unlocked) {
            console.log(`Achievement already unlocked: ${achievement.name} (ID: ${achievement.id})`);
            return;
        }

        try {
            console.log(`Unlocking achievement: ${achievement.name} (ID: ${achievement.id}, Steam: ${achievement.steamApiName})`);

            // Update local state
            achievement.unlocked = true;
            this.stats.unlockedAchievements.add(achievementId);
            console.log(`Added achievement ID ${achievementId} to unlocked achievements set`);

            // Unlock in Steam if available
            if (this.steamClient && this.isSteamRunning) {
                try {
                    console.log(`Attempting to unlock in Steam: ${achievement.steamApiName}`);
                    await this.steamClient.achievement.activate(achievement.steamApiName);
                    console.log(`Achievement unlocked in Steam: ${achievement.name}`);
                } catch (steamError) {
                    console.error(`Failed to unlock achievement in Steam: ${steamError.message}`);
                }
            } else {
                console.log(`Achievement unlocked locally (Steam not running): ${achievement.name}`);
            }

            // Save stats
            this.saveStats();

            // Notify any listeners
            this.notifyAchievementUnlocked(achievement);

        } catch (error) {
            console.error(`Failed to unlock achievement ${achievementId}:`, error);
        }
    }

    // Method to register callbacks for achievement unlocks
    onAchievementUnlocked(callback) {
        this.pageVisitCallbacks.push(callback);
    }

    // Method to notify listeners about achievement unlocks
    notifyAchievementUnlocked(achievement) {
        this.pageVisitCallbacks.forEach(callback => {
            try {
                callback(achievement);
            } catch (error) {
                console.error('Error in achievement unlock callback:', error);
            }
        });
    }

    getAchievementProgress(achievementId) {
        const achievement = this.achievements.find(a => a.id === achievementId);
        if (!achievement) {
            return {
                unlocked: false,
                progress: 0
            };
        }

        if (achievement.unlocked) {
            return {
                unlocked: true,
                progress: 100
            };
        }

        if (achievement.type === 'playtime') {
            const totalSeconds = this.stats.totalPlayTime;
            const progress = Math.min(100, (totalSeconds / achievement.requirement) * 100);
            return {
                unlocked: false,
                progress: Math.round(progress)
            };
        } else if (achievement.type === 'visitpage') {
            const hasVisited = this.stats.visitedPages.has(achievement.requirement);
            return {
                unlocked: hasVisited,
                progress: hasVisited ? 100 : 0
            };
        }

        return {
            unlocked: false,
            progress: 0
        };
    }

    getAllAchievements() {
        return this.achievements.map(achievement => ({
            ...achievement,
            progress: this.getAchievementProgress(achievement.id)
        }));
    }

    getTotalPlayTime() {
        return this.stats.totalPlayTime;
    }

    getFormattedPlayTime() {
        const totalSeconds = this.stats.totalPlayTime;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        return {
            hours,
            minutes,
            seconds,
            totalSeconds,
            formatted: `${hours}h ${minutes}m ${seconds}s`
        };
    }

    resetAchievements() {
        if (!this.steamClient || !this.isSteamRunning) {
            console.log('Cannot reset achievements - Steam not running');
            return false;
        }

        try {
            console.log('Resetting all achievements...');

            // Reset all achievements in Steam
            this.steamClient.achievement.resetAll();

            // Reset local state
            this.achievements.forEach(achievement => {
                achievement.unlocked = false;
            });
            this.stats.unlockedAchievements.clear();
            this.stats.visitedPages.clear();

            // Save stats
            this.saveStats();

            console.log('All achievements reset successfully');
            return true;
        } catch (error) {
            console.error('Failed to reset achievements:', error);
            return false;
        }
    }

    isSteamAvailable() {
        return this.isSteamRunning && this.steamClient !== null;
    }

    shutdown() {
        console.log('Shutting down Achievement Manager...');

        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        this.updatePlaytime(true);
        this.saveStats();

        console.log('Achievement Manager shutdown complete');
    }
}

module.exports = AchievementManager;