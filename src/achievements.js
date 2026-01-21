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
            lastSessionStart: Date.now()
        };
        this.isSteamRunning = false;
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
                        console.log(`Achievement already unlocked in Steam: ${achievement.name}`);
                    }
                } else {
                    console.warn(`Achievement not found in Steam: ${achievement.steamApiName}`);
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
                this.stats.lastSessionStart = savedStats.lastSessionStart || Date.now();

                // Update achievements unlocked status
                this.achievements.forEach(achievement => {
                    if (this.stats.unlockedAchievements.has(achievement.id)) {
                        achievement.unlocked = true;
                    }
                });

                console.log(`Loaded stats: ${this.stats.totalPlayTime}s playtime, ${this.stats.unlockedAchievements.size} achievements unlocked`);
            } else {
                console.log('No saved stats found, starting fresh');
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    saveStats() {
        try {
            const statsToSave = {
                totalPlayTime: this.stats.totalPlayTime,
                unlockedAchievements: Array.from(this.stats.unlockedAchievements),
                lastSessionStart: this.stats.lastSessionStart,
                lastSaveTime: Date.now()
            };

            fs.writeFileSync(this.statsFilePath, JSON.stringify(statsToSave, null, 2));
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

    async unlockAchievement(achievementId) {
        const achievement = this.achievements.find(a => a.id === achievementId);

        if (!achievement) {
            console.error(`Achievement not found: ${achievementId}`);
            return;
        }

        if (achievement.unlocked) {
            console.log(`Achievement already unlocked: ${achievement.name}`);
            return;
        }

        try {
            console.log(`Unlocking achievement: ${achievement.name} (${achievement.steamApiName})`);

            // Update local state
            achievement.unlocked = true;
            this.stats.unlockedAchievements.add(achievementId);

            // Unlock in Steam if available
            if (this.steamClient && this.isSteamRunning) {
                try {
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

        } catch (error) {
            console.error(`Failed to unlock achievement ${achievementId}:`, error);
        }
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