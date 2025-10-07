        let currentAnimal = null, currentCategory = null, currentSlide = 0, editingAnimalId = null, editingJsonId = null;
        let dataJsFileHandle = null;
        let touchStartX = 0, touchEndX = 0;
        let filteredAnimals = [];
        let showAllAnimals = false;
		let iucnPieChartInstance = null;

        // Dictionnaire pour traduire les clés JSON en titres affichables
const titresTraduits = {
    // Section Alimentation
    regime: "Régime",
    familles_preferees: "Familles préférées",
    complement: "Complément",
    role_ecologique: "Rôle écologique",

    // Section Comportement
    social: "Social",
    habitat_vertical: "Habitat vertical",
    locomotion: "Locomotion",

    // Section Vocalisations
    // La clé "description" est utilisée ailleurs, on la laisse telle quelle.
    description: "Description",
    portee: "Portée",
    frequence: "Fréquence",
    amplification: "Amplification",

    // Section Reproduction
    systeme: "Système",
    parade: "Parade",
    nidification: "Nidification",
    ponte: "Ponte",
    incubation: "Incubation",
    soins: "Soins"
};

        const idb = {
            db: null,
            init: async function(dbName, storeName) {
                return new Promise((resolve, reject) => {
                    if (!('indexedDB' in window)) return reject('IndexedDB non supporté');
                    const request = indexedDB.open(dbName, 1);
                    request.onerror = () => reject("Erreur IndexedDB");
                    request.onsuccess = () => { this.db = request.result; resolve(); };
                    request.onupgradeneeded = event => {
                        const db = event.target.result;
                        if (!db.objectStoreNames.contains(storeName)) db.createObjectStore(storeName);
                    };
                });
            },
            get: async function(storeName, key) {
                return new Promise((resolve, reject) => {
                    const tx = this.db.transaction(storeName, 'readonly');
                    const store = tx.objectStore(storeName);
                    const request = store.get(key);
                    request.onerror = () => reject("Erreur de lecture");
                    request.onsuccess = () => resolve(request.result);
                });
            },
            set: async function(storeName, key, value) {
                return new Promise((resolve, reject) => {
                    const tx = this.db.transaction(storeName, 'readwrite');
                    const store = tx.objectStore(storeName);
                    const request = store.put(value, key);
                    request.onerror = () => reject("Erreur d'écriture");
                    request.onsuccess = () => resolve();
                });
            }
        };
        
        let categories = {
          "oiseaux": {
                    "name": "Oiseaux",
                    "color": "#FFB6C1",
                    "icon": {
                              "url": "https://github.com/bobfmayer/Images/blob/main/Silhouette%20Cephalopterus.png?raw=true"
                    }
          },
          "mammiferes": {
                    "name": "Mammifères",
                    "color": "#DDA0DD",
                    "icon": {
                              "url": "https://github.com/bobfmayer/Images/blob/main/Orang-outan%20en%20Brachiation.png?raw=true"
                    }
          },
          "animaux-marins": {
                    "name": "Animaux Marins",
                    "color": "#ADD8E6",
                    "icon": {
                              "url": "https://github.com/bobfmayer/Images/blob/main/Pomacanthus%20Imperator%20Vectoriel.png?raw=true"
                    }
          },
          "insectes": {
                    "name": "Insectes",
                    "color": "#90EE90",
                    "icon": {
                              "url": "https://github.com/bobfmayer/Images/blob/main/Scarab%C3%A9e.png?raw=true"
                    }
          },
          "amphibiens": {
                    "name": "Amphibiens",
                    "color": "#AFEEEE",
                    "icon": {
                              "url": "https://github.com/bobfmayer/Images/blob/main/Grenouille.png?raw=true"
                    }
          },
          "reptiles": {
                    "name": "Reptiles",
                    "color": "#FFDAB9",
                    "icon": {
                              "url": "https://github.com/bobfmayer/Images/blob/main/Crotale%20en%20Alerte.png?raw=true"
                    }
          }
};
        const categoryOrder = ['oiseaux', 'mammiferes', 'animaux-marins', 'insectes', 'amphibiens', 'reptiles'];
        const iucnStatusMap = { 
            'CR': { name: 'En danger critique', color: '#d32f2f', textColor: '#ffffff' }, 
            'EN': { name: 'En danger', color: '#ef6c00', textColor: '#ffffff' }, 
            'VU': { name: 'Vulnérable', color: '#f9a825', textColor: '#000000' }, 
            'LC': { name: 'Préoccupation mineure', color: '#4caf50', textColor: '#ffffff' }, 
            'DD': { name: 'Données insuffisantes', color: '#9e9e9e', textColor: '#ffffff' }, 
            'NE': { name: 'Non évalué', color: '#e0e0e0', textColor: '#000000' } 
        };
        
        

        document.addEventListener('DOMContentLoaded', async () => {
            try {
                await idb.init('encyclopediaDB', 'fileStore');
                dataJsFileHandle = await idb.get('fileStore', 'dataJsFileHandle');
                if (fileHandle) {
                    if (await fileHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
                        fileHandle = null; 
                    }
                }
                const savedTheme = await idb.get('fileStore', 'theme');
                if (savedTheme === 'dark') {
                    document.documentElement.setAttribute('data-theme', 'dark');
                }
            } catch (err) {
                console.warn("Impossible d'initialiser la persistance:", err);
            }
            generateCategoryCards();
            showCategoryScreen();
            initSearchListener();
            initCarouselSwipe();
        });

        // THÈME
        async function toggleTheme() {
            const current = document.documentElement.getAttribute('data-theme');
            const newTheme = current === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme === 'dark' ? 'dark' : '');
            try {
                await idb.set('fileStore', 'theme', newTheme);
            } catch (err) {}
            addRipple(event);
        }
		
		//Traduction du vocabulaire
		
		// NOUVELLE FONCTION À AJOUTER
function getDynamicReproductionLabel(labelKey, category) {
    const labelMappings = {
        'mammiferes': {
            nidification: 'Mise bas', // Ou 'Abri' selon le contexte
            ponte: 'Portée',          // Plus précis que 'ponte' pour les mammifères
            incubation: 'Gestation'     // Le terme correct
        },
        'animaux-marins': {
            nidification: 'Site de ponte', // Souvent plus pertinent pour les poissons
            ponte: 'Frai',              // Le terme technique pour la ponte des poissons
            incubation: 'Incubation'      // Ce terme reste correct pour le développement des œufs
        },
        'amphibiens': {
            nidification: 'Site de ponte',
            ponte: 'Ponte',
            incubation: 'Incubation'
        },
        'reptiles': {
            nidification: 'Site de ponte',
            ponte: 'Ponte',
            incubation: 'Incubation'
        }
        // Pour les 'oiseaux' et 'insectes', les termes par défaut sont corrects
    };

    // Si une traduction spécifique existe pour cette catégorie et cette clé, on l'utilise
    if (labelMappings[category] && labelMappings[category][labelKey]) {
        return labelMappings[category][labelKey];
    }

    // Sinon, on utilise le dictionnaire par défaut (conçu pour les oiseaux)
    return titresTraduits[labelKey] || labelKey.replace(/_/g, ' ');
}

        // RECHERCHE GLOBALE
        function toggleSearch() {
            const search = document.getElementById('globalSearch');
            const searchDashboard = document.getElementById('globalSearchDashboard');
            const isDetailView = document.getElementById('animal-detail-view').classList.contains('visible');
            
            if (isDetailView) {
                const isVisible = search.classList.contains('visible');
                search.classList.toggle('visible');
                if (!isVisible) {
                    document.getElementById('searchInput').focus();
                } else {
                    document.getElementById('searchResults').classList.remove('active');
                    document.getElementById('searchInput').value = '';
                }
            } else {
                const isVisible = searchDashboard.classList.contains('visible');
                searchDashboard.classList.toggle('visible');
                if (!isVisible) {
                    document.getElementById('searchInputDashboard').focus();
                } else {
                    document.getElementById('searchResultsDashboard').classList.remove('active');
                    document.getElementById('searchInputDashboard').value = '';
                }
            }
            addRipple(event);
        }

        function initSearchListener() {
            const searchInput = document.getElementById('searchInput');
            searchInput.addEventListener('input', (e) => performSearch(e.target.value, 'searchResults'));
            
            const searchInputDashboard = document.getElementById('searchInputDashboard');
            searchInputDashboard.addEventListener('input', (e) => performSearch(e.target.value, 'searchResultsDashboard'));
        }

        function performSearch(query, resultsId) {
            query = query.toLowerCase().trim();
            const results = document.getElementById(resultsId);
            
            if (!query) {
                results.classList.remove('active');
                return;
            }
            
            const filtered = animalsData.filter(a => 
                a.nom_commun.toLowerCase().includes(query) || 
                a.nom_scientifique.toLowerCase().includes(query)
            );
            
            if (filtered.length > 0) {
                results.innerHTML = filtered.map(a => `
                    <div class="search-result-item" onclick="selectSearchResult('${a.id}')">
                        <strong>${a.nom_commun}</strong><br>
                        <small>${a.nom_scientifique} - ${categories[a.category].name}</small>
                    </div>
                `).join('');
                results.classList.add('active');
            } else {
                results.innerHTML = '<div class="search-result-item">Aucun résultat</div>';
                results.classList.add('active');
            }
        }

        function selectSearchResult(animalId) {
            const animal = animalsData.find(a => a.id === animalId);
            if (animal) {
                showAnimalDetailScreen(animal.category, animalId);
                document.getElementById('globalSearch').classList.remove('visible');
                document.getElementById('globalSearchDashboard').classList.remove('visible');
            }
        }

        // FILTRES
        function applyFilters() {
            loadDashboardAnimals();
        }
		function resetAndApplyFilters() {
            resetFilters();
            applyFilters();
        }

        // NAVIGATION ANIMAUX
        function navigateToPreviousAnimal() {
            const animals = filteredAnimals.length > 0 ? filteredAnimals : animalsData.filter(a => a.category === currentCategory);
            const currentIndex = animals.findIndex(a => a.id === currentAnimal.id);
            const prevIndex = (currentIndex - 1 + animals.length) % animals.length;
            selectAnimal(animals[prevIndex].id);
            addRipple(event);
        }

        function navigateToNextAnimal() {
            const animals = filteredAnimals.length > 0 ? filteredAnimals : animalsData.filter(a => a.category === currentCategory);
            const currentIndex = animals.findIndex(a => a.id === currentAnimal.id);
            const nextIndex = (currentIndex + 1) % animals.length;
            selectAnimal(animals[nextIndex].id);
            addRipple(event);
        }

        // RIPPLE EFFECT
        function addRipple(e) {
            if (!e || !e.currentTarget) return;
            const btn = e.currentTarget;
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            const rect = btn.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
            ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        }

        // SWIPE CAROUSEL
        function initCarouselSwipe() {
            document.addEventListener('touchstart', e => {
                if (e.target.closest('.carousel-container')) {
                    touchStartX = e.changedTouches[0].screenX;
                }
            });
            
            document.addEventListener('touchend', e => {
                if (e.target.closest('.carousel-container')) {
                    touchEndX = e.changedTouches[0].screenX;
                    handleSwipe();
                }
            });
        }

        function handleSwipe() {
            if (touchEndX < touchStartX - 50) moveCarousel(1);
            if (touchEndX > touchStartX + 50) moveCarousel(-1);
        }

        // GESTION DES VUES
        function generateCategoryCards() {
            document.getElementById('categoryGrid').innerHTML = categoryOrder.map(key => {
                const cat = categories[key];
                const catId = key.replace(/\s+/g, '-').toLowerCase();
                return `<div class="category-card" id="${catId}-card" onclick="showCategoryDashboard('${key}')"><div class="icon-container"><img src="${cat.icon.data || cat.icon.url}" alt="${cat.name}"></div><h2>${cat.name}</h2></div>`
            }).join('');
        }

        function showCategoryScreen() {
			currentCategory = null;
            document.getElementById('category-selection-screen').classList.remove('hidden');
            document.getElementById('category-dashboard').classList.remove('visible');
            document.getElementById('animal-detail-view').classList.remove('visible');
            document.getElementById('fab-container-home').style.display = 'flex';
            document.getElementById('animalNavigation').classList.remove('visible');
            document.getElementById('globalSearch').classList.remove('visible');
            document.getElementById('globalSearchDashboard').classList.remove('visible');
            document.documentElement.style.removeProperty('--accent-color');
            
            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('sidebarOverlay').classList.remove('active');
            const hamburger = document.querySelector('.hamburger-btn');
            if (hamburger) hamburger.classList.remove('active');
			document.getElementById('progressBar').classList.remove('active');
        }

        function showCategoryDashboard(categoryKey) {
			 const dashboard = document.getElementById('category-dashboard');

    // 1. On s'assure que tout est bien caché (surtout le dashboard)
    document.getElementById('category-selection-screen').classList.add('hidden');
    dashboard.classList.remove('visible');
    document.getElementById('animal-detail-view').classList.remove('visible');

    // 2. ON REMONTE EN HAUT PENDANT QUE LE DASHBOARD EST INVISIBLE
    window.scrollTo(0, 0);

    // 3. On prépare toutes les données
    currentCategory = categoryKey;
    showAllAnimals = false;
    document.documentElement.style.setProperty('--accent-color', categories[categoryKey].color);
    // ... (toutes les lignes qui préparent le contenu)
    document.getElementById('dashboardCategoryTitle').textContent = categories[categoryKey].name;
    document.getElementById('dashboardCategorySubtitle').textContent = `Découvrez tous les ${categories[categoryKey].name.toLowerCase()} de notre encyclopédie`;
    // ... etc.
    populateFilters();
    resetFilters();
    loadDashboardAnimals();
    loadDashboardStats();
    loadDashboardCharts();
    document.getElementById('progressBar').classList.remove('active');

    // 4. SEULEMENT MAINTENANT, on rend le dashboard visible
    requestAnimationFrame(() => {
    dashboard.classList.add('visible');
});
        }
		
        function getSingularCategoryName(categoryKey) {
            // Si on est sur la page d'accueil, il n'y a pas de catégorie active.
            if (!categoryKey || !categories[categoryKey]) {
                return 'Animal'; // On retourne la valeur par défaut
            }

            const categoryNamePlural = categories[categoryKey].name; // ex: "Oiseaux"
            
            // Gère le cas spécial "Animaux Marins"
            if (categoryNamePlural === 'Animaux Marins') {
                return 'Animal Marin';
            }
            // Gère les pluriels qui se terminent par 'x' ou 's'
            if (categoryNamePlural.endsWith('x') || categoryNamePlural.endsWith('s')) {
                return categoryNamePlural.slice(0, -1); // Oiseaux -> Oiseau, Reptiles -> Reptile
            }
            
            return categoryNamePlural; // Retourne le nom tel quel s'il ne correspond à aucune règle
        }
		
        function populateFilters() {
            const categoryAnimals = animalsData.filter(a => a.category === currentCategory);
            
            // Remplir filtre Classe
            const classes = [...new Set(categoryAnimals.map(a => a.taxonomie?.classe).filter(Boolean))].sort();
            const classeSelect = document.getElementById('filterClasse');
            classeSelect.innerHTML = '<option value="">Toutes</option>' + 
                classes.map(c => `<option value="${c}">${c}</option>`).join('');
            
            // Remplir filtre Ordre
            const ordres = [...new Set(categoryAnimals.map(a => a.taxonomie?.ordre).filter(Boolean))].sort();
            const ordreSelect = document.getElementById('filterOrdre');
            ordreSelect.innerHTML = '<option value="">Tous</option>' + 
                ordres.map(o => `<option value="${o}">${o}</option>`).join('');
        }

        function resetFilters() {
            document.getElementById('filterIUCN').value = '';
            document.getElementById('filterClasse').value = '';
            document.getElementById('filterOrdre').value = '';
            document.getElementById('filterTendance').value = '';
        }

        function toggleShowMore() {
            showAllAnimals = !showAllAnimals;
            loadDashboardAnimals();
            const btn = document.querySelector('.show-more-btn');
            if (btn) {
                btn.textContent = showAllAnimals ? 'Voir moins' : 'Voir plus';
            }
        }

        function loadDashboardStats() {
            const categoryAnimals = animalsData.filter(a => a.category === currentCategory);
            const total = categoryAnimals.length;
            const endangered = categoryAnimals.filter(a => ['CR', 'EN', 'VU'].includes(a.conservation?.statut_iucn)).length;
            
            document.getElementById('dashboardStats').innerHTML = `
                <div class="stat-card">
                    <span class="stat-number">${total}</span>
                    <span class="stat-label">Espèces</span>
                </div>
                <div class="stat-card">
                    <span class="stat-number">${endangered}</span>
                    <span class="stat-label">Menacées</span>
                </div>
            `;
        }

        function loadDashboardCharts() {
            const categoryAnimals = animalsData.filter(a => a.category === currentCategory);
            const total = categoryAnimals.length;
            
            const iucnCounts = {};
            Object.keys(iucnStatusMap).forEach(key => iucnCounts[key] = 0);
            
            categoryAnimals.forEach(a => {
                // --- Logique de correction ci-dessous ---
                const status = a.conservation?.statut_iucn;
                // On vérifie si le statut est valide, sinon on le classe comme 'NE' (Non évalué)
                if (status && iucnStatusMap[status]) {
                    iucnCounts[status]++;
                } else {
                    iucnCounts['NE']++;
                }
                // --- Fin de la correction ---
            });
            
            const barChartHTML = Object.entries(iucnCounts)
                .filter(([_, count]) => count > 0)
                .map(([status, count]) => {
                    const info = iucnStatusMap[status];
                    const percentage = total > 0 ? (count / total * 100).toFixed(1) : 0;
                    return `
                        <div class="chart-bar">
                            <div class="chart-bar-label">
                                <span>${info.name}</span>
                                <span>${count} (${percentage}%)</span>
                            </div>
                            <div class="chart-bar-fill" data-width="${percentage}%" style="background: ${info.color};">
                                ${count}
                            </div>
                        </div>
                    `;
                }).join('');
            document.getElementById('iucnBarChart').innerHTML = barChartHTML;
            
            setupChartAnimations(iucnCounts, total);
        }

        function drawPieChart(iucnCounts, total) {
            const canvas = document.getElementById('iucnPieChart');
            if (!canvas) return; // Sécurité
            const ctx = canvas.getContext('2d');

            // Détruire l'ancien graphique s'il existe pour éviter les bugs d'affichage
            if (iucnPieChartInstance) {
                iucnPieChartInstance.destroy();
            }

            const filteredData = Object.entries(iucnCounts).filter(([_, count]) => count > 0);

            iucnPieChartInstance = new Chart(ctx, {
                type: 'pie', // Type de graphique
                data: {
                    labels: filteredData.map(([status, _]) => iucnStatusMap[status].name),
                    datasets: [{
                        data: filteredData.map(([_, count]) => count),
                        backgroundColor: filteredData.map(([status, _]) => iucnStatusMap[status].color),
                        borderWidth: 2,
                        borderColor: getComputedStyle(document.documentElement).getPropertyValue('--card-bg-color'),
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: getComputedStyle(document.documentElement).getPropertyValue('--text-dark'),
                                padding: 20,
                                // --- LIGNES À AJOUTER CI-DESSOUS ---
                                usePointStyle: true,    // Dit à Chart.js d'utiliser le pointStyle
                                pointStyle: 'circle',   // Définit la forme comme un cercle
                            }
                        }
                    },
                    animation: {
                        animateScale: true,
                        animateRotate: true
                    }
                }
            });
            document.getElementById('pieLegend').innerHTML = '';
        }
		
        function setupChartAnimations(iucnCounts, total) {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Animer les barres (code existant)
                const chartBars = entry.target.querySelectorAll('.chart-bar-fill');
                chartBars.forEach(bar => {
                    bar.style.width = bar.dataset.width;
                });

                // NOUVEAU : si c'est la carte du camembert, on le dessine
                if (entry.target.querySelector('#iucnPieChart')) {
                    drawPieChart(iucnCounts, total);
                }

                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    const chartCards = document.querySelectorAll('.chart-card');
    chartCards.forEach(card => observer.observe(card));
}
		function updateScrollProgressBar() {
            const progressBar = document.getElementById('progressBar');
            if (!progressBar) return; // Sécurité si la barre n'existe pas

            // Méthode robuste pour obtenir la position et les hauteurs, compatible tous navigateurs
            const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop;
            const scrollHeight = Math.max(
                document.body.scrollHeight, document.documentElement.scrollHeight,
                document.body.offsetHeight, document.documentElement.offsetHeight,
                document.body.clientHeight, document.documentElement.clientHeight
            );
            const clientHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

            const scrollableHeight = scrollHeight - clientHeight;

            if (scrollableHeight <= 0) {
                progressBar.style.width = '0%';
                return;
            }

            const scrolledPercentage = (scrollTop / scrollableHeight) * 100;
            
            // On s'assure que le pourcentage ne dépasse jamais 100%
            const finalPercentage = Math.min(scrolledPercentage, 100);

            progressBar.style.width = `${finalPercentage}%`;
        }
		
        function loadDashboardAnimals() {
            let animals = animalsData.filter(a => a.category === currentCategory);
            
            const iucnFilter = document.getElementById('filterIUCN').value;
            const classeFilter = document.getElementById('filterClasse').value;
            const ordreFilter = document.getElementById('filterOrdre').value;
            const tendanceFilter = document.getElementById('filterTendance').value;
            
            if (iucnFilter) {
                animals = animals.filter(a => a.conservation?.statut_iucn === iucnFilter);
            }
            if (classeFilter) {
                animals = animals.filter(a => a.taxonomie?.classe === classeFilter);
            }
            if (ordreFilter) {
                animals = animals.filter(a => a.taxonomie?.ordre === ordreFilter);
            }
            if (tendanceFilter) {
                animals = animals.filter(a => a.conservation?.tendance === tendanceFilter);
            }
            
            filteredAnimals = animals;
            
            const totalAnimals = animals.length;
            const animalsToShow = showAllAnimals ? animals : animals.slice(0, 4);
            
            const grid = document.getElementById('animalsGrid');
            grid.innerHTML = animalsToShow.map(animal => {
                const statusInfo = iucnStatusMap[animal.conservation?.statut_iucn] || iucnStatusMap['NE'];
                const imageUrl = animal.images?.[0]?.url || animal.images?.[0]?.data || '';
                
                return `
                    <div class="animal-card" onclick="showAnimalDetailScreen('${currentCategory}', '${animal.id}')">
                        <div class="animal-card-image-container">
                            ${imageUrl ? `<img src="${imageUrl}" alt="${animal.nom_commun}" class="animal-card-image" loading="lazy">` : ''}
                        </div>
                        <div class="animal-card-content">
                            <h3 class="animal-card-title">${animal.nom_commun}</h3>
                            <p class="animal-card-subtitle">${animal.nom_scientifique}</p>
                            <span class="animal-card-badge" style="background: ${statusInfo.color}; color: ${statusInfo.textColor || '#000'};">
                                ${statusInfo.name}
                            </span>
                        </div>
                    </div>
                `;
            }).join('');
            
            const showMoreContainer = document.getElementById('showMoreContainer');
            if (totalAnimals > 4) {
                showMoreContainer.style.display = 'block';
                const btn = document.querySelector('.show-more-btn');
                if (btn) {
                    btn.textContent = showAllAnimals ? 'Voir moins' : 'Voir plus';
                }
            } else {
                showMoreContainer.style.display = 'none';
            }
            
            if (animals.length === 0) {
                grid.innerHTML = `
                    <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-light);">
                        <p style="font-size: 1.2rem;">Aucun animal trouvé avec ces critères.</p>
                    </div>
                `;
                showMoreContainer.style.display = 'none';
            }
        }

        function showAnimalDetailScreen(categoryKey, animalIdToLoad = null) {
            
            // --- NOUVEAU BLOC POUR RÉINITIALISER L'INTERFACE ---
            const detailView = document.getElementById('animal-detail-view');
            const uiElementsToReset = [
                detailView.querySelector('.home-btn'),
                detailView.querySelector('.back-btn'),
                detailView.querySelector('.save-as-btn'),
                detailView.querySelector('.theme-toggle-btn'),
                detailView.querySelector('.search-toggle-btn'),
                document.getElementById('breadcrumbDetail')
            ];
            uiElementsToReset.forEach(el => {
                if (el) el.classList.remove('ui-hidden');
            });
            // --- FIN DU NOUVEAU BLOC ---

            currentCategory = categoryKey;
            document.getElementById('category-selection-screen').classList.add('hidden');
            document.getElementById('category-dashboard').classList.remove('visible');
            detailView.classList.add('visible');
            document.getElementById('fab-container-home').style.display = 'none';
            document.getElementById('animalNavigation').classList.add('visible');

            document.getElementById('sidebar').classList.remove('active');
            document.getElementById('sidebarOverlay').classList.remove('active');
            const hamburger = document.querySelector('.hamburger-btn');
            if (hamburger) hamburger.classList.remove('active');

            document.documentElement.style.setProperty('--accent-color', categories[categoryKey].color);
            document.getElementById('sidebarTitle').textContent = categories[categoryKey].name;
            
            let idToLoad = animalIdToLoad;
            if (!idToLoad) {
                const firstAnimal = animalsData.find(a => a.category === categoryKey);
                idToLoad = firstAnimal ? firstAnimal.id : null;
            }
            
            loadAnimal(idToLoad); 
            loadAnimalList(); 
			document.getElementById('progressBar').classList.add('active');
        }

        // GESTION DES ANIMAUX
        function loadAnimalList() {
            const list = document.getElementById('animalList');
            let animals = animalsData.filter(a => a.category === currentCategory);
            
            filteredAnimals = animals;
            
            list.innerHTML = animals.map(animal => `
                <li class="animal-item ${currentAnimal && animal.id === currentAnimal.id ? 'active' : ''}" data-animal-id="${animal.id}">
                    <div class="animal-info" onclick="selectAnimal('${animal.id}')"><h3>${animal.nom_commun}</h3><p>${animal.nom_scientifique}</p></div>
                    <button class="edit-images-btn" onclick="openEditImagesModal('${animal.id}', event)" title="Images"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></button>
                    <button class="edit-json-btn" onclick="openEditJSONModal('${animal.id}', event)" title="JSON"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                    <button class="delete-animal-btn" onclick="deleteAnimal('${animal.id}', event)" title="Supprimer"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                </li>`).join('');
        }

        function selectAnimal(animalId) {
            loadAnimal(animalId);
            loadAnimalList();
            if (window.innerWidth <= 768) {
                toggleSidebar();
            }
        }

        function loadAnimal(animalId) { 
            currentAnimal = animalId ? animalsData.find(a => a.id === animalId) : null; 
            renderAnimalContent(); 
            if (animalId) { 
                window.scrollTo({ top: 0, behavior: 'smooth' }); 
                currentSlide = 0; 
                setTimeout(() => { 
                    initCarousel(); 
                    initCounters(); 
                    initScrollAnimations(); 
                }, 100); 
            } 
        }

        async function deleteAnimal(animalId, event) { 
            event.stopPropagation(); 
            if (!confirm(`Supprimer cet animal ?`)) return; 
            animalsData = animalsData.filter(a => a.id !== animalId); 
            await saveFile();
            showCategoryDashboard(currentCategory); 
            showNotification('Animal supprimé avec succès !', 'success');
        }

        // MOTEUR DE RENDU
        function renderAnimalContent() {
            const content = document.getElementById('content');
            const nav = document.getElementById('mainNav');
            if (!currentAnimal) { 
                content.innerHTML = `<header><h1>Aucun animal</h1></header>`; 
                nav.style.display = 'none'; 
                return; 
            }
            
            nav.style.display = 'none';
            
            document.getElementById('breadcrumbCategoryLink').textContent = categories[currentCategory].name;
            document.getElementById('breadcrumbAnimal').textContent = currentAnimal.nom_commun;
            
            const a = currentAnimal;
            const statusInfo = iucnStatusMap[a.conservation?.statut_iucn] || iucnStatusMap['NE'];
            
            const validImages = a.images ? a.images.filter(img => (img.url && img.url !== "undefined" && !img.url.includes('placeholder.com')) || img.data) : [];

            const statsGridHTML = (mensurations) => {
                if (!mensurations) return '';
                let html = '';
                const createStat = (data, label) => {
                    if (!data) return '';
                    const target = data.max || data.valeur || 0;
                    const prefix = data.min ? `${data.min}-` : '';
                    return `<div class="stat-box"><span class="stat-number" data-target="${target}" data-prefix="${prefix}">0</span><span class="stat-label">${label} (${data.unite})</span></div>`;
                };
                html += createStat(mensurations.male?.longueur, 'Longueur ♂');
                html += createStat(mensurations.femelle?.longueur, 'Longueur ♀');
                html += createStat(mensurations.male?.masse, 'Masse ♂');
                html += createStat(mensurations.femelle?.masse, 'Masse ♀');
                html += createStat(mensurations.caroncule_max, 'Caroncule max');
                return `<div class="stats-grid">${html}</div>`;
            };

            const descriptionHTML = (description) => {
                if (!description || !description.male || !description.femelle) return '';
                return `
                    <h4>Dimorphisme Sexuel</h4>
                    <p><strong>Mâle adulte :</strong></p>
                    <ul>${description.male.map(trait => `<li>${trait}</li>`).join('')}</ul>
                    <p><strong>Femelle adulte :</strong></p>
                    <ul>${description.femelle.map(trait => `<li>${trait}</li>`).join('')}</ul>
                `;
            };

            const nomsInternationauxHTML = (noms) => {
                if (!noms) return '';
                const tabs = [];
                const francaisData = noms.français || noms.francais; 

                if (francaisData) tabs.push('français');
                if (noms.anglais) tabs.push('anglais');
                if (noms.espagnol) tabs.push('espagnol');
                if (noms.allemand || noms.turc || noms.arabe || noms.japonais) tabs.push('autres');

                const francais = francaisData ? `<div id="français" class="tab-content ${tabs[0] === 'français' ? 'active' : ''}"><h3>Français</h3><p><strong>Nom principal :</strong> ${francaisData.principal}</p>${francaisData.synonyme ? `<p><strong>Synonyme :</strong> ${francaisData.synonyme}</p>` : ''}</div>` : '';
                const anglais = noms.anglais ? `<div id="anglais" class="tab-content ${tabs[0] === 'anglais' ? 'active' : ''}"><h3>Anglais</h3><p><strong>Nom :</strong> ${noms.anglais}</p></div>` : '';
                let espagnolContent = '';
                if (noms.espagnol) {
                    espagnolContent += `<div id="espagnol" class="tab-content ${tabs[0] === 'espagnol' ? 'active' : ''}"><h3>Espagnol</h3>`;
                    if (noms.espagnol.standard) espagnolContent += `<p><strong>Nom standard :</strong> ${noms.espagnol.standard}</p>`;
                    if (noms.espagnol.colombie) espagnolContent += `<p><strong>Colombie :</strong> ${noms.espagnol.colombie}</p>`;
                    if (noms.espagnol.equateur) espagnolContent += `<p><strong>Équateur :</strong> ${noms.espagnol.equateur}</p>`;
                    if (noms.espagnol.regionaux) espagnolContent += `<p><strong>Noms régionaux :</strong> ${noms.espagnol.regionaux}</p>`;
                    espagnolContent += `</div>`;
                }
                let autresContent = '';
                if (noms.allemand || noms.turc || noms.arabe || noms.japonais) {
                    autresContent += `<div id="autres" class="tab-content ${tabs[0] === 'autres' ? 'active' : ''}"><h3>Autres Langues</h3>`;
                    if (noms.allemand) autresContent += `<p><strong>Allemand :</strong> ${noms.allemand}</p>`;
                    if (noms.turc) autresContent += `<p><strong>Turc :</strong> ${noms.turc}</p>`;
                    if (noms.arabe && noms.arabe.nom) autresContent += `<p><strong>Arabe :</strong> ${noms.arabe.nom}</p>`;
                    if (noms.japonais && noms.japonais.nom) autresContent += `<p><strong>Japonais :</strong> ${noms.japonais.nom} (${noms.japonais.romaji})</p>`;
                    autresContent += `</div>`;
                }

                return `
                    <section id="langues" class="container">
                        <div class="glass-card">
                            <h2>Noms Internationaux</h2>
                            <div class="tabs">
                                ${tabs.map((tab, i) => `<button class="tab-btn ${i===0 ? 'active' : ''}" onclick="showTab('${tab}', this)">${tab === 'français' ? 'Français' : tab.charAt(0).toUpperCase() + tab.slice(1)}</button>`).join('')}
                            </div>
                            ${francais}${anglais}${espagnolContent}${autresContent}
                        </div>
                    </section>`;
            };
            
            const taxonomieHTML = (taxonomie) => {
                if (!taxonomie) return '';
                const formattedEntries = Object.entries(taxonomie).map(([key, value]) => {
                    let label = key.charAt(0).toUpperCase() + key.slice(1);
                    if (key === 'regne') {
                        label = 'Règne';
                    }
                    return `<div class="taxonomy-item"><div class="taxonomy-label">${label}</div><div class="taxonomy-value">${value}</div></div>`;
                }).join('');
                const etymologieHTML = a.etymologie ? `<h3>Étymologie</h3><p><b>${a.taxonomie.genre}:</b> ${a.etymologie.genre.origine} - "${a.etymologie.genre.signification}"</p><p><b>${a.nom_scientifique.split(' ')[1]}:</b> ${a.etymologie.espece.origine} - "${a.etymologie.espece.signification}"</p>` : '';
                return `<section id="taxonomie" class="container"><div class="glass-card"><h2>Classification Taxonomique</h2><div class="taxonomy-grid">${formattedEntries}</div>${etymologieHTML}</div></section>`;
            };

            content.innerHTML = `
                <header id="accueil"><h1>${a.nom_commun}</h1><p class="subtitle">${a.nom_scientifique}</p></header>
                
                <section id="galerie" class="container">
    <div class="glass-card">
        <div class="gallery-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px;">
            <h2 style="margin-bottom: 0; margin-top: 0;">Galerie Photographique</h2>
            ${validImages.length === 0 ? `
                <button class="add-gallery-images-btn" style="width: 55px; height: 55px; background: var(--card-bg-color); box-shadow: var(--shadow); border: 1px solid var(--border-color); border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; padding: 0; flex-shrink: 0;" onclick="openEditImagesModal('${a.id}', event)" title="Ajouter des images">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                        <circle cx="8.5" cy="8.5" r="1.5"></circle>
                        <polyline points="21 15 16 10 5 21"></polyline>
                    </svg>
                </button>
            ` : ''}
        </div>
        ${validImages.length > 0 ? `
            <div class="carousel-container">
                <div class="carousel-wrapper" id="carouselWrapper">
                    ${validImages.map(img => `<div class="carousel-slide"><img src="${img.url || img.data}" alt="Photo de ${a.nom_commun}" loading="lazy"></div>`).join('')}
                </div>
                ${validImages.length > 1 ? `
                    <button class="carousel-btn prev" onclick="moveCarousel(-1)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                    </button>
                    <button class="carousel-btn next" onclick="moveCarousel(1)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                ` : ''}
            </div>
            ${validImages.length > 1 ? `<div class="carousel-indicators">${validImages.map((_, i) => `<span class="indicator" onclick="goToSlide(${i})"></span>`).join('')}</div>` : ''}
        ` : `
            <p style="text-align: center; padding: 40px 20px; color: var(--text-light); font-style: italic;">Aucune image n'est actuellement disponible pour cet animal.</p>
        `}
    </div>
</section>
                
                ${taxonomieHTML(a.taxonomie)}
                
                ${a.noms_internationaux ? nomsInternationauxHTML(a.noms_internationaux) : ''}

                ${(a.description || a.mensurations) ? `<section id="description" class="container"><div class="glass-card"><h2>Description & Mensurations</h2>${statsGridHTML(a.mensurations)}${descriptionHTML(a.description)}</div></section>` : ''}
 
                ${a.biologie ? `<section id="biologie" class="container"><div class="glass-card"><h2>Biologie & Comportement</h2>${Object.entries(a.biologie).map(([k,v])=>`<div class="accordion-item"><div class="accordion-header" onclick="toggleAccordion(this)"><h3>${k.charAt(0).toUpperCase() + k.slice(1)}</h3><span class="accordion-icon">▼</span></div><div class="accordion-content"><ul>${Object.entries(v).map(([sk,sv])=>`<li><strong>${getDynamicReproductionLabel(sk, a.category)}:</strong> ${Array.isArray(sv) ? sv.join(', ') : sv}</li>`).join('')}</ul></div></div>`).join('')}</div></section>` : ''}                ${a.habitat ? `<section id="habitat" class="container"><div class="glass-card"><h2>Habitat & Répartition</h2><h3>Habitat</h3><p>${a.habitat.type} entre ${a.habitat.altitude.min} et ${a.habitat.altitude.max} ${a.habitat.altitude.unite}.</p><p><b>Préférences:</b> ${a.habitat.preferences}</p><h3>Répartition Géographique</h3><p><b>Bio-région:</b> ${a.habitat.repartition.bioregion}</p><ul>${Object.entries(a.habitat.repartition.pays).map(([p,d])=>`<li><b>${p}:</b> ${d}</li>`).join('')}</ul><h3>Mouvements</h3><p><b>Type:</b> ${a.habitat.mouvements.type}</p><ul><li><b>Année:</b> ${a.habitat.mouvements.annee}</li><li><b>Reproduction:</b> ${a.habitat.mouvements.reproduction}</li></ul></div></section>` : ''}
                
                ${a.conservation ? `<section id="conservation" class="container"><div class="glass-card"><h2>Conservation</h2><div style="text-align:center;"><div class="status-badge" style="background-color:${statusInfo.color};color:${statusInfo.textColor||'#000'};">${statusInfo.name}</div><p>IUCN - ${a.conservation.annee_evaluation}</p></div>${a.conservation.population ? `<div class="stats-grid">${(a.conservation.population.min === 0 && a.conservation.population.max === 0) ? `<div class="stat-box"><span class="stat-number" style="font-size: 1.5rem; line-height: 1.2; font-weight: 600;">Non estimée</span><span class="stat-label">${a.conservation.population.description}</span></div>` : `<div class="stat-box"><span class="stat-number" data-target="${a.conservation.population.max}" data-prefix="${a.conservation.population.min}-">0</span><span class="stat-label">${a.conservation.population.description}</span></div>`}<div class="stat-box"><span class="stat-number">${a.conservation.tendance === 'Décroissante' ? '↓' : (a.conservation.tendance === 'Croissante' ? '↑' : (a.conservation.tendance === 'Stable' ? '–' : '→'))}</span><span class="stat-label">Tendance</span></div></div>` : ''}${a.conservation.menaces ? `<h3>Menaces Principales</h3>${a.conservation.menaces.map(m=>`<div class="accordion-item"><div class="accordion-header" onclick="toggleAccordion(this)"><h3>${m.titre}</h3><span class="accordion-icon">▼</span></div><div class="accordion-content"><p>${m.description}</p></div></div>`).join('')}`:''}${a.conservation.mesures ? `<h3>Mesures de Conservation</h3><ul>${a.conservation.mesures.map(m=>`<li>${m}</li>`).join('')}</ul>` : ''}</div></section>` : ''}
                
                ${a.anecdotes ? `<section id="anecdotes" class="container"><div class="glass-card"><h2>Faits Remarquables</h2>${a.anecdotes.map(an => `<div class="fact-box"><h3>${an.titre}</h3><p>${an.description}</p></div>`).join('')}</div></section>` : ''}
                
                <footer><p>${a.nom_commun}</p></footer>`;
        }
        
        // MODALS
        function openJSONModal() {
            editingJsonId = null;

            // On utilise notre nouvelle fonction pour rendre le titre dynamique
            const singularName = getSingularCategoryName(currentCategory);
            document.getElementById('jsonModalTitle').textContent = `Ajouter un ${singularName}`;

            document.getElementById('submitJsonBtn').textContent = 'Ajouter';
            document.getElementById('jsonTextarea').value = '';
            document.getElementById('jsonError').style.display = 'none';
            document.getElementById('jsonModal').classList.add('active');
        }

        function openEditJSONModal(animalId, event) { 
            event.stopPropagation(); 
            editingJsonId = animalId; 
            const animal = animalsData.find(a => a.id === animalId); 
            document.getElementById('jsonModalTitle').textContent = `Modifier ${animal.nom_commun}`; 
            document.getElementById('submitJsonBtn').textContent = 'Modifier'; 
            document.getElementById('jsonTextarea').value = JSON.stringify(animal, null, 2); 
            document.getElementById('jsonError').style.display = 'none';
            document.getElementById('jsonModal').classList.add('active'); 
        }

        function closeJSONModal() { 
            document.getElementById('jsonModal').classList.remove('active'); 
        }

        async function submitJSON() {
            const errorDiv = document.getElementById('jsonError');
            errorDiv.style.display = 'none';
            try {
                const jsonText = document.getElementById('jsonTextarea').value;
                if (!jsonText.trim()) { throw new Error("Le champ JSON ne peut pas être vide."); }
                const jsonData = JSON.parse(jsonText);
                const required = ['id', 'category', 'nom_commun', 'nom_scientifique'];
                for(const field of required) { 
                    if(!jsonData[field]) throw new Error(`Champ requis manquant: '${field}'`); 
                }
                
                const index = animalsData.findIndex(a => a.id === jsonData.id);
                if (editingJsonId) {
                    animalsData[animalsData.findIndex(a => a.id === editingJsonId)] = jsonData;
                } else if (index !== -1) {
                    if (!confirm("Un animal avec cet ID existe déjà. Voulez-vous le remplacer ?")) return;
                    animalsData[index] = jsonData;
                } else {
                    animalsData.push(jsonData);
                }
                
                await saveFile();
                closeJSONModal();
                showCategoryDashboard(jsonData.category);
                showNotification('Animal sauvegardé avec succès !', 'success');
            } catch (e) {
                errorDiv.textContent = 'Erreur: ' + e.message;
                errorDiv.style.display = 'block';
            }
        }
        
        function openEditImagesModal(animalId, event) { 
            event.stopPropagation(); 
            editingAnimalId = animalId; 
            const animal = animalsData.find(a => a.id === animalId); 
            for (let i = 1; i <= 4; i++) { 
                const preview = document.getElementById(`preview${i}`);
                const input = document.getElementById(`imageUrl${i}`); 
                preview.style.backgroundImage = ''; 
                delete preview.dataset.base64; 
                input.value = ''; 
                const img = animal.images?.[i-1]; 
                if(img) { 
                    if(img.data) { 
                        preview.style.backgroundImage = `url(${img.data})`; 
                        preview.dataset.base64 = img.data; 
                    } else if (img.url) { 
                        input.value = img.url; 
                    } 
                } 
            } 
            document.getElementById('editImagesModal').classList.add('active'); 
        }

        function closeEditImagesModal() { 
            document.getElementById('editImagesModal').classList.remove('active'); 
        }

        async function saveImages() { 
            const animal = animalsData.find(a => a.id === editingAnimalId); 
            if (!animal) return; 
            animal.images = []; 
            for (let i = 1; i <= 4; i++) { 
                const base64 = document.getElementById(`preview${i}`).dataset.base64; 
                const url = document.getElementById(`imageUrl${i}`).value; 
                if (base64) animal.images.push({data: base64}); 
                else if (url) animal.images.push({url: url}); 
            }
            await saveFile();
            loadAnimal(editingAnimalId); 
            closeEditImagesModal();
            showNotification('Images mises à jour !', 'success');
        }

        function openEditIconsModal() {
            const container = document.getElementById('category-icon-upload-container');
            container.innerHTML = categoryOrder.map(key => {
                const cat = categories[key];
                return `
                    <div class="image-upload-box">
                        <label>${cat.name}</label>
                        <input type="url" class="image-url-input" id="icon-imageUrl-${key}" placeholder="https://example.com/icon.png">
                    </div>
                `
            }).join('');

            Object.entries(categories).forEach(([key, cat]) => {
                const input = document.getElementById(`icon-imageUrl-${key}`);
                if (input) {
                    input.value = cat.icon.url || cat.icon.data || '';
                }
            });

            document.getElementById('editIconsModal').classList.add('active');
        }

        function closeEditIconsModal() { 
            document.getElementById('editIconsModal').classList.remove('active'); 
        }

        async function saveCategoryIcons() {
            const defaultIcon = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M12 2L2 7l10 5 10-5-10-5z'/%3E%3Cpath d='M2 17l10 5 10-5'/%3E%3Cpath d='M2 12l10 5 10-5'/%3E%3C/svg%3E`;
            Object.keys(categories).forEach(key => {
                const input = document.getElementById(`icon-imageUrl-${key}`);
                if (input) {
                    const url = input.value.trim();
                    if(url) {
                        if(url.startsWith('data:image')) {
                            categories[key].icon = { data: url };
                        } else {
                            categories[key].icon = { url: url };
                        }
                    } else {
                        categories[key].icon = { data: defaultIcon };
                    }
                }
            });
            await saveFile();
            generateCategoryCards();
            closeEditIconsModal();
            showNotification('Icônes mises à jour !', 'success');
        }

        // SAUVEGARDE

        function fallbackDownload(htmlContent) {
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'encyclopedie-animale.html';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
		
		async function saveFile(forceSaveAs = true) {
    const dataContent = generateDataString();

    try {
        // Si on n'a pas encore mémorisé le fichier, ou si on force "Enregistrer sous..."
        if (!dataJsFileHandle || forceSaveAs) {
            const options = {
                types: [{
                    description: 'Fichier de données JavaScript',
                    accept: { 'text/javascript': ['.js'] },
                }],
                suggestedName: 'data.js',
            };
            // On demande à l'utilisateur de choisir l'emplacement UNE SEULE FOIS
            dataJsFileHandle = await window.showSaveFilePicker(options);
            // On sauvegarde le "raccourci" dans la base de données du navigateur pour s'en souvenir
            await idb.set('fileStore', 'dataJsFileHandle', dataJsFileHandle);
        }

        // On écrit directement dans le fichier mémorisé, sans ouvrir de fenêtre
        const writable = await dataJsFileHandle.createWritable();
        await writable.write(dataContent);
        await writable.close();

        if (!forceSaveAs) { // N'affiche la notification que pour les sauvegardes automatiques
            showNotification('Données enregistrées !', 'success');
        }

    } catch (err) {
        if (err.name !== 'AbortError') {
            showNotification("Erreur d'enregistrement.", 'error');
            // Si l'erreur est due à une permission perdue, on réinitialise pour redemander la prochaine fois
            dataJsFileHandle = null;
            await idb.set('fileStore', 'dataJsFileHandle', null);
        }
    }
}

        function generateDataString() {
    return `let animalsData = ${JSON.stringify(animalsData, null, 4)};`;
}

        function showNotification(message, type = 'info') {
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            let icon = '✓';
            if (type === 'error') icon = '✕';
            if (type === 'info') icon = 'ℹ';
            notification.innerHTML = `<span style="font-size: 1.2rem;">${icon}</span><span>${message}</span>`;
            document.body.appendChild(notification);
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.5s ease forwards';
                setTimeout(() => notification.remove(), 500);
            }, 4000);
        }

        // UTILITAIRES
        function toggleSidebar() { 
            document.getElementById('sidebar').classList.toggle('active'); 
            document.getElementById('sidebarOverlay').classList.toggle('active'); 
            document.querySelector('.hamburger-btn').classList.toggle('active'); 
        }

        function initCarousel() { 
            if (currentAnimal?.images?.length > 0) updateCarousel(); 
        }

        function updateCarousel() { 
            const wrapper = document.getElementById('carouselWrapper');
            if (wrapper) {
                wrapper.style.transform = `translateX(-${currentSlide * 100}%)`; 
                document.querySelectorAll('.indicator').forEach((ind, i) => ind.classList.toggle('active', i === currentSlide));
            }
        }

        function moveCarousel(dir) { 
            const total = currentAnimal.images.length; 
            if (total <= 1) return; 
            currentSlide = (currentSlide + dir + total) % total; 
            updateCarousel(); 
        }

        function goToSlide(index) { 
            currentSlide = index; 
            updateCarousel(); 
        }

        function showTab(tabName, btn) { 
            const parent = btn.closest('.glass-card'); 
            parent.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active')); 
            parent.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); 
            parent.querySelector('#' + tabName).classList.add('active'); 
            btn.classList.add('active'); 
        }

        function toggleAccordion(header) { 
            header.parentElement.classList.toggle('active'); 
        }

        function initScrollAnimations() { 
            const obs = new IntersectionObserver(e => e.forEach(entry => { 
                if(entry.isIntersecting){ 
                    entry.target.style.opacity = '1'; 
                    entry.target.style.transform = 'translateY(0)'; 
                    obs.unobserve(entry.target); 
                } 
            }), {threshold: 0.1}); 
            document.querySelectorAll('.glass-card').forEach(c => obs.observe(c)); 
        }

        function animateCounter(el) {
            const targetMax = parseInt(el.dataset.target);
            if (isNaN(targetMax)) return;
            const prefix = el.dataset.prefix || '';
            const hasRange = prefix.endsWith('-');
            const targetMin = hasRange ? parseInt(prefix, 10) : null;
            let startTimestamp = null;
            const duration = 1500;
            const step = (timestamp) => {
                if (!startTimestamp) startTimestamp = timestamp;
                const progress = Math.min((timestamp - startTimestamp) / duration, 1);
                const currentMax = Math.floor(progress * targetMax);
                if (hasRange && targetMin !== null && !isNaN(targetMin)) {
                    const currentMin = Math.floor(progress * targetMin);
                    el.textContent = `${currentMin}-${currentMax}`;
                } else {
                    el.textContent = prefix + currentMax;
                }
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                } else {
                    if (hasRange && targetMin !== null && !isNaN(targetMin)) {
                        el.textContent = `${targetMin}-${targetMax}`;
                    } else {
                        el.textContent = prefix + targetMax;
                    }
                }
            };
            window.requestAnimationFrame(step);
        }

        function initCounters() { 
            const obs = new IntersectionObserver(e => e.forEach(entry => { 
                if(entry.isIntersecting){ 
                    animateCounter(entry.target); 
                    obs.unobserve(entry.target); 
                } 
            }), {threshold: 0.5}); 
            document.querySelectorAll('.stat-number[data-target]').forEach(c => obs.observe(c)); 
        }

        window.addEventListener('scroll', () => {
            const detailView = document.getElementById('animal-detail-view');

            if (!detailView.classList.contains('visible')) {
                return;
            }

            // Votre code existant pour masquer les éléments du haut
            const uiElementsToHide = [
                detailView.querySelector('.home-btn'),
                detailView.querySelector('.back-btn'),
                detailView.querySelector('.save-as-btn'),
                detailView.querySelector('.theme-toggle-btn'),
                detailView.querySelector('.search-toggle-btn'),
                document.getElementById('breadcrumbDetail')
            ];

            if (window.scrollY > 30) {
                uiElementsToHide.forEach(el => {
                    if (el) el.classList.add('ui-hidden');
                });
            } else {
                uiElementsToHide.forEach(el => {
                    if (el) el.classList.remove('ui-hidden');
                });
            }

            // --- BLOC DE CODE MANQUANT À RAJOUTER ---
const scrollToTopBtn = document.getElementById('scrollToTopBtn');
if (scrollToTopBtn) {
    // On vérifie si l'utilisateur a défilé de plus de 300px vers le bas
    if (window.scrollY > 300) {
        scrollToTopBtn.style.display = 'flex'; // On affiche le bouton
    } else {
        scrollToTopBtn.style.display = 'none'; // On le masque
    }
}
            // --- FIN DU BLOC ---

            updateScrollProgressBar();

        });
