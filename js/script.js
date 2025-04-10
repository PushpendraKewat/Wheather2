const weatherApp = {
    apiKey: "868ebca87bab8e0429ad2ef872303c81", // Replace with your actual API key
    cacheExpiry: 15 * 60 * 1000, // 15 minutes cache
    maxImageRetries: 3,
    initialized: false,
    reliableBackgrounds: [
        'https://images.unsplash.com/photo-1496450681664-3df85efbd29f', // cloudy
        'https://images.unsplash.com/photo-1560258018-c7db7645254e', // sunny
        'https://images.unsplash.com/photo-1515694346937-94d85e41e6f0', // nature
        'https://images.unsplash.com/photo-1504608524841-42fe6f032b4b'  // weather
    ],
    
    // Initialization
    init() {
        if (this.initialized) return;
        
        // Check authentication
        if (sessionStorage.getItem('weatherAppLoggedIn') !== 'true') {
            window.location.href = 'login.html';
            return;
        }

        this.loadDarkMode();
        this.setupEventListeners();
        this.setDefaultBackground();
        this.initialized = true;
        
        // Set up logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            sessionStorage.removeItem('weatherAppLoggedIn');
            sessionStorage.removeItem('weatherAppUsername');
            window.location.href = 'login.html';
        });
    },
    
    setDefaultBackground() {
        const background = document.querySelector('.background');
        background.style.backgroundImage = 'url(https://source.unsplash.com/1600x900/?weather,sky)';
        background.style.opacity = 1;
    },
    
    // Event Handling
    setupEventListeners() {
        document.getElementById('weatherForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.getWeather();
        });
        
        document.getElementById('locationBtn').addEventListener('click', () => {
            this.getWeatherByLocation();
        });
        
        document.getElementById('darkModeBtn')?.addEventListener('click', () => {
            this.toggleDarkMode();
        });
    },
    
    loadDarkMode() {
        if (localStorage.getItem('darkMode') === 'enabled') {
            document.body.classList.add('dark-mode');
            const btn = document.getElementById('darkModeBtn');
            if (btn) btn.textContent = '☀️ Toggle Light Mode';
        }
    },
    
    // Weather Data Methods
    async getWeather() {
        const city = document.getElementById('cityInput').value.trim();
        if (!city) {
            this.showError('Please enter a city name.');
            return;
        }
        
        try {
            this.setLoadingState(true);
            await this.fetchWeatherData(`q=${encodeURIComponent(city)}`);
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setLoadingState(false);
        }
    },
    
    getWeatherByLocation() {
        if (!navigator.geolocation) {
            this.showError("Geolocation is not supported by your browser.");
            return;
        }
        
        this.setLoadingState(true, 'Getting your location...');
        
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                try {
                    const { latitude, longitude } = position.coords;
                    await this.fetchWeatherData(`lat=${latitude}&lon=${longitude}`);
                } catch (error) {
                    this.showError(error.message);
                } finally {
                    this.setLoadingState(false);
                }
            },
            (error) => {
                this.showError(this.getGeolocationError(error));
                this.setLoadingState(false);
            },
            { 
                timeout: 10000,
                enableHighAccuracy: true 
            }
        );
    },
    
    // Data Fetching
    async fetchWeatherData(query) {
        const cacheKey = `weather_${query}`;
        const cachedData = this.getFromCache(cacheKey);
        
        if (cachedData) {
            this.displayWeather(cachedData.current);
            this.displayForecast(cachedData.forecast);
            return;
        }
        
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const [currentResponse, forecastResponse] = await Promise.all([
                fetch(`https://api.openweathermap.org/data/2.5/weather?${query}&units=metric&appid=${this.apiKey}`, {
                    signal: controller.signal
                }),
                fetch(`https://api.openweathermap.org/data/2.5/forecast?${query}&units=metric&appid=${this.apiKey}`, {
                    signal: controller.signal
                })
            ]);
            
            clearTimeout(timeoutId);
            
            if (!currentResponse.ok || !forecastResponse.ok) {
                const errorData = await currentResponse.json().catch(() => null);
                throw new Error(errorData?.message || 'Failed to fetch weather data');
            }
            
            const [currentData, forecastData] = await Promise.all([
                currentResponse.json(),
                forecastResponse.json()
            ]);
            
            this.saveToCache(cacheKey, {
                current: currentData,
                forecast: forecastData
            });
            
            this.displayWeather(currentData);
            this.displayForecast(forecastData);
            
        } catch (error) {
            console.error("Fetch error:", error);
            throw new Error(error.name === 'AbortError' 
                ? "Request timed out. Please try again." 
                : "Couldn't retrieve weather data. Please try again.");
        }
    },
    
    // Background Image Handling
    async setBackground(weatherCondition) {
        const background = document.querySelector('.background');
        const overlay = document.querySelector('.overlay');
        
        // Immediate fallback if no condition
        if (!weatherCondition) {
            this.setDefaultBackground();
            return;
        }

        try {
            // Fade out current background
            background.style.opacity = 0;
            overlay.style.opacity = 0;
            await new Promise(resolve => setTimeout(resolve, 300));

            // Try multiple image sources
            const urls = [
                this.getBackgroundUrl(weatherCondition),
                this.getBackgroundUrl('default'), // Fallback 1
                'https://source.unsplash.com/random/1600x900/?weather' // Fallback 2
            ];

            let success = false;
            
            // Try each URL in sequence
            for (const url of urls) {
                try {
                    await this.preloadImage(url);
                    background.style.backgroundImage = `url(${url})`;
                    background.style.opacity = 1;
                    overlay.style.opacity = 1;
                    success = true;
                    break;
                } catch (e) {
                    console.warn(`Failed to load ${url}, trying next`);
                }
            }
            
            if (!success) {
                // If all URLs failed, try our reliable backgrounds
                for (const imgUrl of this.reliableBackgrounds) {
                    try {
                        await this.preloadImage(imgUrl);
                        background.style.backgroundImage = `url(${imgUrl})`;
                        background.style.opacity = 1;
                        overlay.style.opacity = 1;
                        success = true;
                        break;
                    } catch (e) {
                        console.warn("Fallback image failed:", imgUrl);
                        continue;
                    }
                }
            }
            
            if (!success) {
                throw new Error('All image sources failed');
            }
            
        } catch (error) {
            console.error("Background load failed:", error);
            this.setColoredBackground(weatherCondition);
        }
    },
    
    async preloadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            let timer = setTimeout(() => {
                img.onload = img.onerror = null;
                reject(new Error('Timeout'));
            }, 8000); // 8 second timeout

            img.onload = () => {
                clearTimeout(timer);
                resolve();
            };
            img.onerror = () => {
                clearTimeout(timer);
                reject(new Error('Failed to load'));
            };
            img.src = url;
        });
    },
    
    getBackgroundUrl(weatherCondition) {
        const condition = (weatherCondition || '').toLowerCase().trim();
        const searchTerms = {
            'rain': 'rain,rainy,storm',
            'clouds': 'cloudy,clouds',
            'clear': 'sunny,clear+sky',
            'snow': 'snow,winter',
            'thunderstorm': 'thunderstorm,lightning',
            'default': 'weather,sky'
        };
        const term = searchTerms[condition] || searchTerms.default;
        return `https://source.unsplash.com/1600x900/?${term.replace(/\s+/g, '+')}`;
    },
    
    setColoredBackground(condition) {
        const background = document.querySelector('.background');
        const overlay = document.querySelector('.overlay');
        const colors = {
            'rain': '#4a6fa5',
            'clear': '#47abcc',
            'clouds': '#7a9cc6',
            'snow': '#e6f0f9',
            'default': '#6b9ac4'
        };
        background.style.backgroundImage = 'none';
        background.style.backgroundColor = colors[condition] || colors.default;
        background.style.opacity = 1;
        overlay.style.opacity = 1;
    },
    
    // Display Methods
    displayWeather(data) {
        try {
            if (!data?.weather?.[0]) {
                throw new Error('Invalid weather data');
            }
            
            const condition = data.weather[0].main;
            const windDirection = this.getWindDirection(data.wind?.deg || 0);
            const date = new Date(data.dt * 1000).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            document.getElementById('weatherResult').innerHTML = `
                <h2>${data.name}, ${data.sys?.country || ''}</h2>
                <p><em>${date}</em></p>
                <img class="weather-icon" src="https://openweathermap.org/img/wn/${data.weather[0].icon}@2x.png" 
                     alt="${data.weather[0].description || 'Weather icon'}">
                <h3>${Math.round(data.main.temp)}°C</h3>
                <p>${condition} (${data.weather[0].description || ''})</p>
                
                <div class="weather-details">
                    <div class="weather-detail">
                        <span>Feels Like:</span>
                        <span>${Math.round(data.main.feels_like)}°C</span>
                    </div>
                    <div class="weather-detail">
                        <span>Humidity:</span>
                        <span>${data.main.humidity}%</span>
                    </div>
                    <div class="weather-detail">
                        <span>Wind:</span>
                        <span>${data.wind.speed} m/s ${windDirection}</span>
                    </div>
                    <div class="weather-detail">
                        <span>Pressure:</span>
                        <span>${data.main.pressure} hPa</span>
                    </div>
                </div>
            `;
            
            // Set background after displaying weather
            this.setBackground(condition).catch(e => {
                console.error("Background error:", e);
            });
            
        } catch (error) {
            console.error("Display error:", error);
            this.showError("Error displaying weather data.");
            this.setDefaultBackground();
        }
    },
    
    displayForecast(data) {
        try {
            if (!data?.list?.length) {
                throw new Error('Invalid forecast data');
            }
            
            const forecastContainer = document.getElementById('forecastResult');
            forecastContainer.innerHTML = '<h3>5-Day Forecast</h3>';
            
            // Get one forecast per day (every 24 hours)
            for (let i = 0; i < Math.min(data.list.length, 40); i += 8) {
                const day = data.list[i];
                const date = new Date(day.dt * 1000);
                const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
                
                const forecastDay = document.createElement('div');
                forecastDay.className = 'forecast-day';
                forecastDay.innerHTML = `
                    <h4>${dayName}</h4>
                    <img class="forecast-icon" src="https://openweathermap.org/img/wn/${day.weather[0].icon}.png" 
                         alt="${day.weather[0].description || 'Forecast icon'}">
                    <p>${Math.round(day.main.temp)}°C</p>
                    <p><small>${day.weather[0].main}</small></p>
                `;
                forecastContainer.appendChild(forecastDay);
            }
        } catch (error) {
            console.error("Forecast error:", error);
            document.getElementById('forecastResult').innerHTML = 
                '<p class="error">⚠️ Error loading forecast</p>';
        }
    },
    
    // Utility Methods
    setLoadingState(isLoading, message = 'Loading...') {
        const searchBtn = document.getElementById('searchBtn');
        const spinner = searchBtn.querySelector('.loading-spinner');
        const buttonText = searchBtn.querySelector('.button-text');
        
        searchBtn.disabled = isLoading;
        buttonText.textContent = isLoading ? message : 'Get Weather';
        spinner.hidden = !isLoading;
        
        if (isLoading) {
            document.getElementById('weatherResult').innerHTML = `
                <div class="loading-container">
                    <span class="loading"></span>
                    <span>${message}</span>
                </div>
            `;
            document.getElementById('forecastResult').innerHTML = '';
        }
    },
    
    showError(message) {
        document.getElementById('weatherResult').innerHTML = `
            <p class="error">⚠️ ${message}</p>
        `;
        document.getElementById('forecastResult').innerHTML = '';
        this.setDefaultBackground();
    },
    
    getGeolocationError(error) {
        switch(error.code) {
            case error.PERMISSION_DENIED:
                return "Location access denied. Please enable location services.";
            case error.POSITION_UNAVAILABLE:
                return "Location information unavailable.";
            case error.TIMEOUT:
                return "Location request timed out.";
            default:
                return "Error getting your location.";
        }
    },
    
    getFromCache(key) {
        try {
            const cached = localStorage.getItem(key);
            if (!cached) return null;
            
            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < this.cacheExpiry) {
                return data;
            }
            return null;
        } catch (e) {
            console.error("Cache read error:", e);
            return null;
        }
    },
    
    saveToCache(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.error("Cache write error:", e);
        }
    },
    
    getWindDirection(degrees) {
        const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        const index = Math.round((degrees % 360) / 45);
        return directions[index % 8];
    },
    
    toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('darkMode', isDark ? 'enabled' : 'disabled');
        
        const btn = document.getElementById('darkModeBtn');
        if (btn) {
            btn.textContent = isDark ? '☀️ Toggle Light Mode' : '🌙 Toggle Dark Mode';
        }
    }
};

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    weatherApp.init();
});