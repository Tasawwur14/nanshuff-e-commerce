// public/assets/js/router.js - FINAL, COMPLETE, AND UNABRIDGED

class SPARouter {
    constructor() {
        this.routes = {
            '/': '/views/home-content.html',
            '/home': '/views/home-content.html',
            '/products': '/views/products.html',
            '/product': '/views/product-details.html',
            '/cart': '/views/cart.html',
            '/about': '/views/about.html',
            '/whyfrozen': '/views/whyfrozen.html',
            '/myths': '/views/myths.html',
            '/contact': '/views/contact.html',
            '/login': '/views/login.html',
            '/profile': '/views/profile.html',
            '/myorders': '/views/myorders.html',
            '/wishlist': '/views/wishlist.html',
            '/privacy': '/views/privacy.html',
            '/return': '/views/return.html'
        };
        // Add route matching function to handle dynamic routes like search and category
        // Uses longest-prefix match to avoid shorter base paths shadowing longer ones
        this.getRoute = (pathname) => {
            // Normalize pathname
            if (!pathname || typeof pathname !== 'string') pathname = '/';
            // Exact match takes priority
            if (this.routes[pathname]) return this.routes[pathname];

            // Sort base paths by length (longest first) so '/products' won't be shadowed by '/prod'
            const basePaths = Object.keys(this.routes).sort((a, b) => b.length - a.length);
            for (const basePath of basePaths) {
                if (basePath === '/') continue;
                // Match if pathname equals basePath, startsWith(basePath + '/') or startsWith(basePath) (covers query-less and with query)
                if (pathname === basePath || pathname.startsWith(basePath + '/') || pathname.startsWith(basePath)) {
                    return this.routes[basePath];
                }
            }

            // Default to home if no route matches
            return this.routes['/'];
        };
        // Make the router instance available globally
        window.router = this;
        this.init();
    }

    init() {
        document.addEventListener('DOMContentLoaded', () => {
            this.initializeGlobalListeners();
            this.attachLinkListeners();
            this.initializeAddToCartButtons();
            this.updateLoginState();
            this.setupAuthUI(); // Make sure this is called on initial load
            // If this page contains the SPA main content container, perform SPA navigation so fragments load into it.
            // Otherwise (direct full page load like product-details), just reinitialize components for the current page.
            const mainContent = document.getElementById('main-content');
            if (mainContent) {
                this.navigate(window.location.pathname + window.location.search);
            } else {
                // For full-page templates (server-rendered pages) call reinitializers directly
                // Use IIFE to handle async operations properly
                (async () => {
                    await this.updateHeaderAuthUI();
                    await this.reinitializeComponents(window.location.search || '');
                })();
            }
        });
        // Handle browser back/forward buttons
        window.addEventListener('popstate', () => {
            // Get the full URL including search parameters
            const fullPath = window.location.pathname + window.location.search;
            this.navigate(fullPath, false);
        });
    }


    initializeGlobalListeners() {
        window.addEventListener('scroll', () => {
            const header = document.getElementById('main-header');
            if (window.scrollY > 20) {
                header.classList.add('header-scrolled');
            } else {
                header.classList.remove('header-scrolled');
            }
        });
    }




    // This function listens for clicks on the ENTIRE page
    attachLinkListeners() {
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.add-to-cart-btn') || e.target.closest('.pswp-gallery')) {
                return;
            }
            // Quick fallback: if login/signup/forgot toggles are clicked but the login initializer
            // didn't run (or panels are missing), handle the panel switching here so the UI remains responsive.
            const showSignup = e.target.closest('#show-signup-btn');
            const showLoginFromSignup = e.target.closest('#show-login-btn-from-signup');
            const showForgot = e.target.closest('#show-forgot-btn');
            const showLoginFromForgot = e.target.closest('#show-login-btn-from-forgot');
            if (showSignup || showLoginFromSignup || showForgot || showLoginFromForgot) {
                e.preventDefault();
                const loginPanel = document.getElementById('login-panel');
                const signupPanel = document.getElementById('signup-panel');
                const forgotPanel = document.getElementById('forgot-panel');
                const panels = [loginPanel, signupPanel, forgotPanel].filter(Boolean);
                // Helper to show one panel and hide others
                const showPanel = (panelToShow) => {
                    panels.forEach(panel => {
                        panel.classList.add('transition-transform', 'duration-500', 'ease-in-out');
                        if (panel !== panelToShow) {
                            panel.classList.add(panel === loginPanel ? '-translate-x-full' : 'translate-x-full');
                            panel.classList.remove('translate-x-0');
                        }
                    });
                    if (panelToShow) {
                        panelToShow.classList.remove('-translate-x-full', 'translate-x-full');
                        panelToShow.classList.add('translate-x-0');
                    }
                };

                if (showSignup) showPanel(signupPanel || null);
                if (showLoginFromSignup) showPanel(loginPanel || null);
                if (showForgot) showPanel(forgotPanel || null);
                if (showLoginFromForgot) showPanel(loginPanel || null);
                return;
            }
            // Check if the clicked element or its parent is an <a> tag
            const link = e.target.closest('a');

            // If the click originated from an add-to-cart button, prevent link navigation
            if (e.target.closest('.add-to-cart-btn')) {
                e.preventDefault(); // Prevent default link navigation
                return; // Let the add-to-cart button handler take care of adding to cart
            }

            // If it's a link, decide whether to handle it as an SPA route
            if (link) {
                const href = link.getAttribute('href') || '';
                // Skip handling for external links, anchors, downloads and target=_blank
                if (!href.startsWith('/') || href.startsWith('//') || href === '#' || link.target === '_blank' || link.hasAttribute('download')) {
                    return;
                }
                // Allow links to opt-out of SPA handling by adding `data-no-spa` attribute
                if (link.hasAttribute && link.hasAttribute('data-no-spa')) {
                    return; // Let the browser perform a normal navigation
                }
                
                // Also bypass SPA for cart links to ensure proper navigation
                if (href === '/cart' || href.startsWith('/cart?')) {
                    return; // Let the browser perform a normal navigation
                }

                // Extract normalized path and search
                const url = new URL(link.href, window.location.origin);
                const path = url.pathname + url.search;

                // Check if page has main content area to determine if SPA navigation is appropriate
                const mainContent = document.getElementById('main-content');
                
                // Don't prevent default for links inside the top navigation or mobile dropdown
                // OR if the page doesn't have a main content area (server-rendered pages)
                if (link.closest('nav') || link.closest('#mobile-dropdown-menu') || !mainContent) {
                    return; // Let the browser perform a full-page navigation
                }

                e.preventDefault(); // Stop the browser from doing a full refresh
                this.navigate(path);
            }
        });
    }

    // public/assets/js/router.js

    async navigate(path, pushState = true) {
    // navigate call
        const mainContent = document.getElementById('main-content');
        if (!mainContent) {
            // If there's no main content area, perform full page navigation instead of SPA
            window.location.href = path;
            return;
        }

        // 1. Smoothly fade out the current content to prevent footer flash
        mainContent.style.opacity = '0';
        // Wait for fade-out to be visible
        await new Promise(resolve => setTimeout(resolve, 150));

        // Normalize the incoming path using the URL API so we always have a consistent pathname + search
        let urlObj;
        try {
            urlObj = new URL(path, window.location.origin);
        } catch (err) {
            // Fallback: if URL parsing fails, treat as root
            urlObj = { pathname: '/', search: '' };
        }

        const pathname = urlObj.pathname;
        const search = urlObj.search;
        let viewPath;

        // 2. Correctly handle dynamic product routes (e.g., /product/12345)
        if (pathname.startsWith('/product/')) {
            viewPath = this.routes['/product'];
        } else {
            // Handle all other static routes including those with query parameters
            viewPath = this.getRoute(pathname);
        }
    // resolved viewPath

        try {
            const response = await fetch(viewPath);
            // If fragment not found on server, fall back to full-page load so server can render the view
            if (!response.ok) {
                // Perform a full navigation to the requested path (server will render the full page)
                window.location.href = path;
                return;
            }

            const text = await response.text();
            // fetched content length
            mainContent.innerHTML = text;

            // 3. Update the browser's URL bar
            if (pushState && (window.location.pathname + window.location.search) !== path) {
                history.pushState({ path }, '', path);
            }

            // 4. Update header UI based on auth status and re-initialize components
            await this.updateHeaderAuthUI();
            await this.reinitializeComponents(search || '');
            mainContent.style.opacity = '1';

        } catch (error) {
            console.error('Navigation Error:', error);
            mainContent.innerHTML = `<div class="text-center p-20"><p>Sorry, the page could not be loaded.</p></div>`;
            mainContent.style.opacity = '1';
        }
    }

    async populateCategories() {
        try {
            const response = await fetch('/api/products/filters');
            if (!response.ok) throw new Error('Failed to fetch filters');
            const data = await response.json();
            
            if (data.categories && data.categories.length > 0) {
                categoryContainer.innerHTML = data.categories.map(cat => `
                    <div><input type="checkbox" value="${cat}" id="cat-${cat.replace(/\s+/g, '-')}"><label for="cat-${cat.replace(/\s+/g, '-')}" class="ml-2 cursor-pointer">${cat}</label></div>
                `).join('');
            } else {
                categoryContainer.innerHTML = `<p class="text-xs text-gray-500">No categories found.</p>`;
            }
        } catch (error) {
            console.error("Error populating categories:", error);
            categoryContainer.innerHTML = `<p class="text-xs text-red-500">Could not load categories.</p>`;
        }
    }

    // === NAYA FUNCTION: ADVANCED FILTERS KE LIYE ===
    async initializeProductPage(searchParams = '') {
        if (!document.getElementById('filters-sidebar')) return;

        const urlParams = new URLSearchParams(searchParams);
        const preselectedCategory = urlParams.get('category');
        const searchQuery = urlParams.get('q');  // Get the search query parameter (using 'q' to match backend)
        let currentPage = parseInt(urlParams.get('page')) || 1;
        
        // Hide category filter section when there's a search query
        if (searchQuery) {
            const categoryFilterGroup = document.getElementById('category-filter-group');
            if (categoryFilterGroup) {
                categoryFilterGroup.style.display = 'none';
            }
        }

        const categoryFilterGroup = document.getElementById('category-filter-group');
        if (preselectedCategory && categoryFilterGroup) {
            categoryFilterGroup.style.display = 'none';
        }

        const productGrid = document.getElementById('product-grid');
        const categoryContainer = document.getElementById('category-filters-container');
        const priceSliderEl = document.getElementById('price-slider');
        const priceLower = document.getElementById('price-lower');
        const priceUpper = document.getElementById('price-upper');
        const sortDropdown = document.getElementById('sort-by');
        const paginationContainer = document.getElementById('pagination-container');
        const productCountEl = document.getElementById('product-count');
        const clearFiltersBtn = document.getElementById('clear-filters-btn');

        if (typeof noUiSlider !== 'undefined' && priceSliderEl) {
            if (priceSliderEl.noUiSlider) {
                priceSliderEl.noUiSlider.destroy();
            }
            const priceSlider = noUiSlider.create(priceSliderEl, {
                start: [0, 10000], connect: true, range: { 'min': 0, 'max': 10000 }, step: 100,
                format: { to: value => `₹${Math.round(value)}`, from: value => Number(String(value).replace('₹', '')) }
            });
            priceSlider.on('update', (values) => {
                priceLower.textContent = values[0];
                priceUpper.textContent = values[1];
            });
            priceSlider.on('change', () => fetchAndRenderProducts(1));
        }
        
        const fetchAndRenderProducts = async (page = 1) => {
        currentPage = page;
        productGrid.innerHTML = `<p class="col-span-full text-center pt-20">Loading products...</p>`;

        // ... parameter collection code same rahega ...
        const selectedCategories = preselectedCategory ? [preselectedCategory] : Array.from(categoryContainer.querySelectorAll('input:checked')).map(cb => cb.value);
        
        const availabilityRadio = document.querySelector('input[name="availability"]:checked');
        const availability = availabilityRadio ? availabilityRadio.value : 'all';
        
        const [minPrice, maxPrice] = priceSliderEl.noUiSlider.get(true);
        const minDiscountRadio = document.querySelector('input[name="discount"]:checked');
        const minDiscountValue = minDiscountRadio ? minDiscountRadio.value : '0';
        const minDiscount = parseInt(minDiscountValue) || 0; // Convert to integer
        const dietaryRadio = document.querySelector('input[name="dietary"]:checked');
        const dietary = dietaryRadio ? dietaryRadio.value : '';
        const sortBy = sortDropdown.value;

        const params = new URLSearchParams({ page: currentPage, limit: 30, minPrice, maxPrice });
        if (selectedCategories.length > 0) params.append('category', selectedCategories.join(','));
        if (availability === 'inStock' || availability === 'outofStock') params.append('availability', availability);
        if (minDiscount > 0) params.append('minDiscount', minDiscount.toString());
        if (dietary) params.append('dietary', dietary);
        if (sortBy !== 'default') params.append('sort', sortBy);
        if (searchQuery) params.append('q', searchQuery);  // Add search query parameter


        try {
            // If search query exists, use the search endpoint; otherwise use the main products endpoint
            let apiUrl;
            let isSearchRequest = !!searchQuery;
            
            if (isSearchRequest) {
                // Use search endpoint for search queries 
                apiUrl = `/api/products/search?${params.toString()}`;
            } else {
                apiUrl = `/api/products?${params.toString()}`;
            }
            
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            // Handle search endpoint response differently (it doesn't return pagination info)
            if (isSearchRequest) {
                // Format search results to match expected structure
                const formattedData = {
                    products: data, // Search endpoint returns array directly
                    totalProducts: data.length,
                    currentPage: 1,
                    totalPages: 1
                };
                
                // Update the data variable to use formatted data for search
                productCountEl.textContent = `${formattedData.totalProducts} items found`;
                
                if (!formattedData.products || formattedData.products.length === 0) {
                    productGrid.innerHTML = '<p class="col-span-full text-center pt-20">No products found for this search.</p>';
                    paginationContainer.innerHTML = '';
                    return;
                }

                productGrid.innerHTML = formattedData.products.map(product => `
                    <div class="bg-white rounded-lg shadow-md overflow-hidden group relative flex flex-col h-full">
                        <button class="wishlist-btn absolute top-3 right-3 bg-white/70 backdrop-blur-sm p-2 rounded-full z-20 hover:bg-red-100 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        </button>
                        
                        <a href="/product/${product.id || product._id}" class="block flex flex-col flex-grow">
                            <div class="relative overflow-hidden h-56 bg-gray-200">
                                <img src="${product.imageUrl || 'https://placehold.co/400x400'}" alt="${product.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300">
                                
                                ${product.discount > 0 ? `
                                    <div class="absolute bottom-3 left-3 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg z-10 shadow-lg">
                                        ${product.discount}% OFF
                                    </div>
                                ` : ''}
                            </div>
                            <div class="p-4 flex flex-col flex-grow">
                                <div class="flex-grow">
                                    <h3 class="font-semibold text-md truncate" title="${product.name}">${product.name}</h3>
                                    <div class="flex items-center gap-2 mt-2">
                                        <p class="text-accent-brown font-bold whitespace-nowrap">₹${product.price}</p>
                                        ${product.discount > 0 ? `
                                            <p class="text-gray-500 line-through text-sm">₹${Math.round(product.price * 100 / (100 - product.discount))}</p>
                                        ` : ''}
                                    </div>
                                </div>
                                <div class="mt-4">
                                    <button class="add-to-cart-btn bg-gradient-to-r from-[#8C6A5D] to-[#73564B] text-white text-sm font-bold px-3 py-2 rounded-md hover:from-[#73564B] hover:to-[#8C6A5D] transition-colors no-spa w-full" data-id="${product.id || product._id}">
                                        Add to Cart
                                    </button>
                                </div>
                            </div>
                        </a>
                    </div>
                `).join('');

                // For search results, we only render 1 page since search endpoint doesn't support pagination
                renderPagination(1, 1);
                if (window.AOS) AOS.refresh();
                return; // Exit early since search results are handled differently
            } else {
                // Handle normal response from products endpoint (with pagination, filters, etc.)
                productCountEl.textContent = `${data.totalProducts || 0} items found`;

                if (!data.products || data.products.length === 0) {
                    productGrid.innerHTML = '<p class="col-span-full text-center pt-20">No products found for these filters.</p>';
                    paginationContainer.innerHTML = '';
                    return;
                }

                productGrid.innerHTML = data.products.map(product => `
                    <div class="bg-white rounded-lg shadow-md overflow-hidden group relative flex flex-col h-full">
                        <button class="wishlist-btn absolute top-3 right-3 bg-white/70 backdrop-blur-sm p-2 rounded-full z-20 hover:bg-red-100 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                        </button>
                        
                        <a href="/product/${product.id || product._id}" class="block flex flex-col flex-grow">
                            <div class="relative overflow-hidden h-56 bg-gray-200">
                                <img src="${product.imageUrl || 'https://placehold.co/400x400'}" alt="${product.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300">
                                
                                ${product.discount > 0 ? `
                                    <div class="absolute bottom-3 left-3 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg z-10 shadow-lg">
                                        ${product.discount}% OFF
                                    </div>
                                ` : ''}
                            </div>
                            <div class="p-4 flex flex-col flex-grow">
                                <div class="flex-grow">
                                    <h3 class="font-semibold text-md truncate" title="${product.name}">${product.name}</h3>
                                    <div class="flex items-center gap-2 mt-2">
                                        <p class="text-accent-brown font-bold whitespace-nowrap">₹${product.price}</p>
                                        ${product.discount > 0 ? `
                                            <p class="text-gray-500 line-through text-sm">₹${Math.round(product.price * 100 / (100 - product.discount))}</p>
                                        ` : ''}
                                    </div>
                                </div>
                                <div class="mt-4">
                                    <button class="add-to-cart-btn bg-gradient-to-r from-[#8C6A5D] to-[#73564B] text-white text-sm font-bold px-3 py-2 rounded-md hover:from-[#73564B] hover:to-[#8C6A5D] transition-colors no-spa w-full" data-id="${product.id || product._id}">
                                        Add to Cart
                                    </button>
                                </div>
                            </div>
                        </a>
                    </div>
                `).join('');

                renderPagination(data.totalPages, data.currentPage);
                if (window.AOS) AOS.refresh();
            }

            if (!data.products || data.products.length === 0) {
                productGrid.innerHTML = '<p class="col-span-full text-center pt-20">No products found for these filters.</p>';
                paginationContainer.innerHTML = '';
                return;
            }

            productGrid.innerHTML = data.products.map(product => `
                <div class="bg-white rounded-lg shadow-md overflow-hidden group relative flex flex-col h-full">
                    <button class="wishlist-btn absolute top-3 right-3 bg-white/70 backdrop-blur-sm p-2 rounded-full z-20 hover:bg-red-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    </button>
                    
                    <a href="/product/${product.id || product._id}" class="block flex flex-col flex-grow">
                        <div class="relative overflow-hidden h-56 bg-gray-200">
                            <img src="${product.imageUrl || 'https://placehold.co/400x400'}" alt="${product.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300">
                            
                            ${product.discount > 0 ? `
                                <div class="absolute bottom-3 left-3 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg z-10 shadow-lg">
                                    ${product.discount}% OFF
                                </div>
                            ` : ''}
                        </div>
                        <div class="p-4 flex flex-col flex-grow">
                            <div class="flex-grow">
                                <h3 class="font-semibold text-md truncate" title="${product.name}">${product.name}</h3>
                                <div class="flex items-center gap-2 mt-2">
                                    <p class="text-accent-brown font-bold whitespace-nowrap">₹${product.price}</p>
                                    ${product.discount > 0 ? `
                                        <p class="text-gray-500 line-through text-sm">₹${Math.round(product.price * 100 / (100 - product.discount))}</p>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="mt-4">
                                <button class="add-to-cart-btn bg-gradient-to-r from-[#8C6A5D] to-[#73564B] text-white text-sm font-bold px-3 py-2 rounded-md hover:from-[#73564B] hover:to-[#8C6A5D] transition-colors no-spa w-full" data-id="${product.id || product._id}">
                                    Add to Cart
                                </button>
                            </div>
                        </div>
                    </a>
                </div>
            `).join('');

            renderPagination(data.totalPages, data.currentPage);
            if (window.AOS) AOS.refresh();
        } catch (error) {
             productGrid.innerHTML = '<p class="col-span-full pt-20 text-red-500">Error loading products.</p>';
        }
    };
        
        const renderPagination = (totalPages, currentPage) => {
            paginationContainer.innerHTML = '';
            const createButton = (text, page, isDisabled = false, isCurrent = false) => {
                const button = document.createElement('button');
                button.innerHTML = text;
                button.dataset.page = page;
                button.disabled = isDisabled;
                let baseClasses = 'px-3 py-1 border rounded-md text-sm';
                let stateClasses = isDisabled ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white hover:bg-gray-100';
                if (isCurrent) {
                    stateClasses = 'bg-accent-brown text-white border-accent-brown';
                }
                button.className = `${baseClasses} ${stateClasses}`;
                return button;
            };

            paginationContainer.appendChild(createButton('&laquo; Prev', currentPage - 1, currentPage === 1));

            const pageInfo = document.createElement('span');
            pageInfo.innerText = `Page ${currentPage} of ${totalPages}`;
            pageInfo.className = "text-sm text-gray-700 px-2";
            paginationContainer.appendChild(pageInfo);

            paginationContainer.appendChild(createButton('Next &raquo;', currentPage + 1, currentPage === totalPages));
        };
        const populateCategories = async () => {
            try {
                const response = await fetch('/api/products/filters');
                const data = await response.json();
                if (data.categories && data.categories.length > 0) {
                    categoryContainer.innerHTML = data.categories.map(cat => `
                        <div><input type="checkbox" value="${cat}" id="cat-${cat.replace(/\s+/g, '-')}"><label for="cat-${cat.replace(/\s+/g, '-')}" class="ml-2 cursor-pointer">${cat}</label></div>
                    `).join('');
                } else {
                    categoryContainer.innerHTML = `<p class="text-xs text-gray-500">No categories found.</p>`;
                }
            } catch (error) {
                categoryContainer.innerHTML = `<p class="text-xs text-red-500">Could not load categories.</p>`;
            }
        };
        
        // 5. Attach all event listeners
        // Add event listener to trigger product refresh when any filter changes
        document.getElementById('filters-sidebar').addEventListener('change', () => fetchAndRenderProducts(1));
        sortDropdown.addEventListener('change', () => fetchAndRenderProducts(1));
        clearFiltersBtn.addEventListener('click', () => {
            const sidebar = document.getElementById('filters-sidebar');
            sidebar.querySelectorAll('input[type=checkbox]').forEach(el => el.checked = false);
            sidebar.querySelectorAll('input[type=radio]').forEach(el => el.checked = el.value === 'all' || el.value === '0' || el.value === '');
            priceSliderEl.noUiSlider.set([0, 10000]);
            sortDropdown.value = 'default';
            fetchAndRenderProducts(1);
        });
        clearFiltersBtn.addEventListener('click', () => { /* ... clear filter logic ... */ });

        if (!preselectedCategory) {
            await populateCategories();
        }
        fetchAndRenderProducts(currentPage);
    }
    
    initializeProductGrid() {
    const productGrid = document.getElementById('product-grid');
    // initializeProductGrid called
    if (!productGrid) return;
    
    // Use the new dedicated endpoint for featured products with proper error handling
    fetch('/api/products/featured')
        .then(res => {
            if (!res.ok) {
                // Check if response is JSON before parsing
                const contentType = res.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    return res.json().then(err => Promise.reject(err));
                }
                // For non-JSON responses (like rate limit text), return text
                return res.text().then(text => Promise.reject({ error: text, status: res.status }));
            }
            return res.json();
        })
        .then(products => {
            if (!products || products.length === 0) {
                productGrid.innerHTML = '<p class="col-span-full text-center">No featured products found.</p>';
                return;
            }
            productGrid.innerHTML = products.map(product => `
                <div class="bg-white rounded-lg shadow-md overflow-hidden group relative flex flex-col h-full">
                    <button class="wishlist-btn absolute top-3 right-3 bg-white/70 backdrop-blur-sm p-2 rounded-full z-20 hover:bg-red-100 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                    </button>
                    
                    <a href="/product/${product.id || product._id}" class="block flex flex-col flex-grow">
                        <div class="relative overflow-hidden h-56 bg-gray-200">
                            <img src="${product.imageUrl || 'https://placehold.co/400x400'}" alt="${product.name}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300">
                            
                            ${product.discount > 0 ? `
                                <div class="absolute bottom-3 left-3 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg z-10 shadow-lg">
                                    ${product.discount}% OFF
                                </div>
                            ` : ''}
                        </div>
                        <div class="p-4 flex flex-col flex-grow">
                            <div class="flex-grow">
                                <h3 class="font-semibold text-md truncate" title="${product.name}">${product.name}</h3>
                                <div class="flex items-center gap-2 mt-2">
                                    <p class="text-accent-brown font-bold whitespace-nowrap">₹${product.price}</p>
                                    ${product.discount > 0 ? `
                                        <p class="text-gray-500 line-through text-sm">₹${Math.round(product.price * 100 / (100 - product.discount))}</p>
                                    ` : ''}
                                </div>
                            </div>
                            <div class="mt-4">
                                <button class="add-to-cart-btn bg-gradient-to-r from-[#8C6A5D] to-[#73564B] text-white text-sm font-bold px-3 py-2 rounded-md hover:from-[#73564B] hover:to-[#8C6A5D] transition-colors no-spa w-full" data-id="${product.id || product._id}">
                                    Add to Cart
                                </button>
                            </div>
                        </div>
                    </a>
                    <!-- Featured badge -->
                    <div class="absolute top-3 left-3 bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-md z-10 flex items-center">
                        <i data-lucide="star" class="w-3 h-3 mr-1"></i> Featured
                    </div>
                </div>
            `).join('');
            
            // Reinitialize lucide icons for the featured badges
            if (window.lucide) {
                window.lucide.createIcons();
            }
            
            if (window.AOS) setTimeout(() => AOS.refresh(), 100);
        })
        .catch(error => {
            console.error('Failed to fetch featured products:', error);
            // Handle rate limiting gracefully
            if (error.status === 429) {
                productGrid.innerHTML = '<p class="col-span-full text-center text-yellow-600">Too many requests. Please wait a moment and refresh the page.</p>';
            } else {
                productGrid.innerHTML = '<p class="col-span-full text-center text-red-500">Error loading products. Please refresh the page.</p>';
            }
        });
}


    // === NEW FUNCTION TO MAKE THE CART PAGE WORK ===
    async initializeCartPage() {
        if (!document.getElementById('cart-content')) return;

        const itemsContainer = document.getElementById('cart-items-container');
        const summarySubtotal = document.getElementById('summary-subtotal');
        const summaryTotal = document.getElementById('summary-total');
        const cartItemCount = document.getElementById('cart-item-count');
        const cartContent = document.getElementById('cart-content');
        const emptyCartMessage = document.getElementById('empty-cart-message');
        const applyBtn = document.getElementById('apply-discount-btn');
        const discountInput = document.getElementById('discount-code');
        const discountMessage = document.getElementById('discount-message');
        let currentSubtotal = 0;

        const renderCart = (cart) => {
            const items = cart.items || [];
            if (items.length === 0) {
                cartContent.classList.add('hidden');
                emptyCartMessage.classList.remove('hidden');
            } else {
                cartContent.classList.remove('hidden');
                emptyCartMessage.classList.add('hidden');

                let subtotal = 0;
                itemsContainer.innerHTML = ''; // Clear any dummy content

                items.forEach(item => {
                    let product, productId;
                    
                    // For logged-in users: cart item has populated product object 
                    if (item.product && typeof item.product === 'object') {
                        product = item.product;
                        productId = product.id || product._id;
                    } 
                    // For non-logged-in users: fields are directly on the item
                    else if (item.name && item.price) {
                        product = item;
                        productId = item.product; // The productId is stored directly as item.product
                    }
                    // Fallback case
                    else {
                        product = { name: 'Unknown Product', price: 0, imageUrl: 'https://placehold.co/100x100/e0dacf/8C6A5D?text=No+Image' };
                        productId = item.product;
                    }
                    
                    const name = product.name || 'Unknown Product';  
                    const price = product.price ? parseFloat(product.price) : 0; // Ensure price is a number
                    const imageUrl = product.imageUrl || 'https://placehold.co/100x100/e0dacf/8C6A5D?text=No+Image';
                    const variant = product.variant || '';
                    const quantity = item.quantity || 1; // Ensure quantity exists

                    const itemTotal = price * quantity;
                    subtotal += itemTotal;

                    const itemHTML = `
                        <div class="cart-item-container flex items-center bg-white p-4 rounded-lg shadow-sm" data-product-id="${productId}">
                            <a href="/product/${productId}" class="product-link">
                                <img src="${imageUrl}" alt="${name}" class="w-20 h-20 object-cover rounded-md">
                            </a>
                            <div class="flex-grow ml-4">
                                <a href="/product/${productId}" class="product-link font-semibold text-text-primary hover:text-accent-brown">${name}</a>
                                <p class="text-sm text-text-secondary">${variant}</p>
                                <div class="flex flex-wrap items-center gap-2 mt-1">
                                    <p class="text-lg font-bold text-accent-brown" data-price="${price}">₹${price.toFixed(2)}</p>
                                    ${product.mrp && product.mrp > 0 && product.discount > 0 && product.mrp !== price ? `<p class="text-sm text-gray-500 line-through">₹${Number(product.mrp).toFixed(2)}</p>` : ''}
                                    ${product.discount > 0 ? `<p class="text-sm font-semibold text-green-600 bg-green-100 px-2 py-1 rounded">(${product.discount}% off)</p>` : ''}
                                </div>
                            </div>
                            <div class="flex items-center space-x-3">
                                <button class="px-2 py-1 border rounded-md update-qty-btn" data-change="-1">-</button>
                                <span class="quantity">${quantity}</span>
                                <button class="px-2 py-1 border rounded-md update-qty-btn" data-change="1">+</button>
                            </div>
                            <div class="ml-6 text-right w-20">
                                <p class="font-semibold">₹${itemTotal.toFixed(2)}</p>
                                <button class="text-xs text-red-500 hover:underline mt-1 remove-item-btn">Remove</button>
                            </div>
                        </div>
                    `;
                    itemsContainer.innerHTML += itemHTML;
                });
                currentSubtotal = subtotal;
                updateSummary();
                
                currentSubtotal = subtotal;
                updateSummary();
            }
            if (window.lucide) window.lucide.createIcons();
        }

        const updateSummary = (discountPercent = 0) => {
            const discountValue = currentSubtotal * (discountPercent / 100);
            const total = currentSubtotal - discountValue;
            summarySubtotal.textContent = `₹${currentSubtotal.toFixed(2)}`;
            summaryTotal.textContent = `₹${total.toFixed(2)}`;

            const discountRow = document.getElementById('discount-row');
            if (discountRow) discountRow.remove();

            if (discountValue > 0) {
                const newDiscountRow = document.createElement('div');
                newDiscountRow.id = 'discount-row';
                newDiscountRow.className = 'flex justify-between text-green-600';
                newDiscountRow.innerHTML = `<span>Discount (${discountPercent}%)</span><span>-₹${discountValue.toFixed(2)}</span>`;
                summarySubtotal.parentElement.parentElement.insertBefore(newDiscountRow, summarySubtotal.parentElement.parentElement.children[1]);
            }
        }

        const fetchCart = async () => {
            try {
                const response = await fetch('/api/cart', { credentials: 'include' });
                const cart = await response.json();
                renderCart(cart);
                this.updateCartCounter();
            } catch (error) {
                console.error('Failed to fetch cart:', error);
            }
        }
        const boundFetchCart = fetchCart.bind(this);

        // Add the event listener for cart operations
        itemsContainer.addEventListener('click', async (e) => {
            const target = e.target;
            
            // Check if the clicked element is a product link
            if (target.classList.contains('product-link') || target.closest('.product-link')) {
                // Allow the product link to be handled by the main router
                return;
            }
            
            const productContainer = target.closest('[data-product-id]');
            if (!productContainer) return;

            const productId = productContainer.dataset.productId;

            if (target.classList.contains('remove-item-btn')) {
                e.preventDefault(); // Prevent any default action
                await this.updateCartItem(productId, 0, boundFetchCart);
            }

            if (target.classList.contains('update-qty-btn')) {
                e.preventDefault(); // Prevent any default action
                const change = parseInt(target.dataset.change);
                const currentQty = parseInt(productContainer.querySelector('.quantity').textContent);
                
                // Validate that we have valid numbers
                if (isNaN(change) || isNaN(currentQty) || currentQty < 0) {
                    console.error('Invalid cart quantity data:', { change, currentQty });
                    return;
                }
                
                const newQty = currentQty + change;
                
                // For quantities going below 1, updateCartItem will handle removal via DELETE
                if (newQty < 1) {
                    // Remove the item from cart
                    await this.updateCartItem(productId, 0, boundFetchCart);
                } else {
                    // Update the quantity
                    await this.updateCartItem(productId, newQty, boundFetchCart);
                }
            }
        });

        applyBtn.addEventListener('click', async () => {
            const code = discountInput.value.trim().toUpperCase();
            if (!code) {
                discountMessage.textContent = 'Please enter a discount code.';
                discountMessage.className = 'text-xs mt-2 h-4 text-red-500';
                return;
            }
            
            try {
                const response = await fetch(`/api/coupons/validate?code=${encodeURIComponent(code)}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const result = await response.json();
                
                if (response.ok && result.valid) {
                    // Update the session with the discount code for server-side processing
                    await fetch('/api/cart/discount', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code, discountPercentage: result.discountPercentage })
                    });
                    
                    updateSummary(result.discountPercentage);
                    discountMessage.textContent = `${code} applied! You get ${result.discountPercentage}% off.`;
                    discountMessage.className = 'text-xs mt-2 h-4 text-green-600';
                } else {
                    // Clear any previously applied discount
                    await fetch('/api/cart/discount', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code: null, discountPercentage: 0 })
                    });
                    
                    updateSummary(0);
                    discountMessage.textContent = result.message || 'Invalid discount code.';
                    discountMessage.className = 'text-xs mt-2 h-4 text-red-500';
                }
            } catch (error) {
                console.error('Error validating discount code:', error);
                updateSummary(0);
                discountMessage.textContent = 'Error validating discount code.';
                discountMessage.className = 'text-xs mt-2 h-4 text-red-500';
            }
        });

        boundFetchCart();
    }

    async updateCartItem(productId, qty, callback) {
        try {
            // Validate inputs before making API call
            if (!productId) {
                console.error('Invalid product ID:', productId);
                throw new Error('Invalid product ID');
            }
            
            if (typeof qty === 'undefined' || qty === null) {
                console.error('Invalid quantity:', qty);
                throw new Error('Invalid quantity');
            }
            
            let response;
            
            if (qty <= 0) {
                // Use DELETE endpoint to remove item from cart
                response = await fetch(`/api/cart/${productId}`, {
                    method: 'DELETE',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                // Use POST endpoint to update quantity
                response = await fetch('/api/cart', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ productId, quantity: qty })
                });
            }
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('Cart update failed:', errorData);
                throw new Error('Failed to update cart: ' + (errorData.message || response.statusText));
            }
            this.updateCartCounter();
            if (callback) await callback();
        } catch (error) {
            console.error('Cart update error:', error);
        }
    }

    
    // Attach event listeners directly to cart item buttons
    attachCartEventListeners(itemsContainer, fetchCartCallback) {
        // Remove any existing listeners to prevent duplicates
        // First, get references to all buttons
        const removeButtons = itemsContainer.querySelectorAll('.remove-item-btn');
        const quantityButtons = itemsContainer.querySelectorAll('.update-qty-btn');
        
        // Add event listeners to remove buttons
        removeButtons.forEach(button => {
            // Remove existing listener if any (to prevent duplicates)
            button.replaceWith(button.cloneNode(true));
            const newButton = itemsContainer.querySelector(`.remove-item-btn[data-product-id="${button.dataset.productId}"]`);
            if (newButton) {
                newButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    const productId = newButton.dataset.productId;
                    this.updateCartItem(productId, 0, fetchCartCallback);
                });
            }
        });
        
        // Add event listeners to quantity buttons
        quantityButtons.forEach(button => {
            // Remove existing listener if any (to prevent duplicates)
            button.replaceWith(button.cloneNode(true));
            const newButton = itemsContainer.querySelector(`.update-qty-btn[data-product-id="${button.dataset.productId}"][data-change="${button.dataset.change}"]`);
            if (newButton) {
                newButton.addEventListener('click', (e) => {
                    e.preventDefault();
                    const productId = newButton.dataset.productId;
                    const change = parseInt(newButton.dataset.change);
                    
                    // Find the corresponding quantity element
                    const container = newButton.closest('.cart-item-container');
                    const quantityElement = container.querySelector('.quantity');
                    const currentQty = parseInt(quantityElement.textContent);
                    
                    if (isNaN(change) || isNaN(currentQty)) {
                        console.error('Invalid quantity data');
                        return;
                    }
                    
                    const newQty = currentQty + change;
                    
                    // For quantities going below 1, remove the item
                    if (newQty < 1) {
                        this.updateCartItem(productId, 0, fetchCartCallback);
                    } else {
                        this.updateCartItem(productId, newQty, fetchCartCallback);
                    }
                });
            }
        });
    }


    initializeAddToCartButtons() {
    document.body.addEventListener('click', async (e) => {
        const addToCartBtn = e.target.closest('.add-to-cart-btn');
        if (addToCartBtn) {
            e.preventDefault();
            e.stopPropagation();

            const productId = addToCartBtn.dataset.productId || addToCartBtn.dataset.id;
            if (!productId) {
                console.error('No product ID found for add to cart button');
                return;
            }

            if (addToCartBtn.disabled) return; // Prevent multiple clicks while processing

            const originalText = addToCartBtn.innerHTML;
            addToCartBtn.innerHTML = 'Adding...';
            addToCartBtn.disabled = true;

            try {
                const cartResponse = await fetch('/api/cart', { credentials: 'include' });
                if (!cartResponse.ok) {
                    throw new Error(`Failed to fetch cart: ${cartResponse.status}`);
                }
                const cart = await cartResponse.json();
                if (!cart.items || !Array.isArray(cart.items)) {
                    console.error('Invalid cart format received:', cart);
                    throw new Error('Invalid cart format');
                }
                
                const existingItem = cart.items.find(item => {
                    // Handle both populated cart (with object) and session cart (with string id)
                    if (typeof item.product === 'object' && (item.product.id || item.product._id)) {
                        return (item.product.id || item.product._id).toString() === productId;
                    } else {
                        return item.product.toString() === productId;
                    }
                });
                
                const currentQty = existingItem ? existingItem.quantity : 0;
                const newQty = currentQty + 1;

                await this.updateCartItem(productId, newQty, this.updateCartCounter.bind(this));
                
                addToCartBtn.innerHTML = 'Added!';
                
                setTimeout(() => {
                    addToCartBtn.innerHTML = originalText;
                    addToCartBtn.disabled = false;
                }, 1000);

            } catch (error) {
                console.error("Add to cart error:", error);
                addToCartBtn.innerHTML = 'Error';
                setTimeout(() => {
                    addToCartBtn.innerHTML = originalText;
                    addToCartBtn.disabled = false;
                }, 2000);
            }
        }
    });
}

    async updateCartCounter() {
        try {
            const response = await fetch('/api/cart', { credentials: 'include' });
            
            // Check response status and content-type before parsing JSON
            if (!response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const error = await response.json();
                    throw new Error(error.error || 'Failed to fetch cart');
                } else {
                    const text = await response.text();
                    throw new Error(text || `HTTP ${response.status}`);
                }
            }
            
            const cart = await response.json();
            const cartBadge = document.getElementById('cart-badge');
            const totalQuantity = (cart.items || []).reduce((acc, item) => acc + item.quantity, 0);
            if (cartBadge) {
                if (totalQuantity > 0) {
                    cartBadge.textContent = totalQuantity;
                    cartBadge.classList.remove('hidden');
                } else {
                    cartBadge.classList.add('hidden');
                }
            }
        } catch (error) {
            console.error('Failed to update cart counter:', error);
            // Don't show error to user, just log it - cart badge will remain unchanged
        }
    }


    ///////////////////
    initializeAuthModal() {
        const accountIcons = document.querySelectorAll('#desktop-account-icon, #mobile-account-icon');
        const modalPlaceholder = document.getElementById('modal-placeholder');

        if (accountIcons.length > 0 && modalPlaceholder) {
            accountIcons.forEach(icon => {
                icon.addEventListener('click', async (e) => {
                    e.preventDefault();
                    if (document.getElementById('premium-login-modal')) return;
                    try {
                        const response = await fetch('/views/login.html');
                        if (!response.ok) throw new Error('Could not fetch login.html');
                        modalPlaceholder.innerHTML = await response.text();

                        const loginModal = document.getElementById('premium-login-modal');
                        if (loginModal) {
                            document.body.appendChild(loginModal);
                            loginModal.style.display = 'flex';
                            loginModal.style.zIndex = '99999';
                            loginModal.style.position = 'fixed';
                            loginModal.style.top = '0';
                            loginModal.style.left = '0';
                            loginModal.style.width = '100vw';
                            loginModal.style.height = '100vh';
                            loginModal.style.justifyContent = 'center';
                            loginModal.style.alignItems = 'center';
                        }

                        this.attachPremiumModalListeners();
                    } catch (error) {
                        console.error("Failed to load modal:", error);
                    }
                });
            });
        }
    }

    showMessage(messageId, text, isError = false) {
        const messageElement = document.getElementById(messageId);
        if (!messageElement) return;
        messageElement.textContent = text;
        messageElement.className = isError ? 'text-red-500 text-center text-sm font-medium' : 'text-green-500 text-center text-sm font-medium';
        setTimeout(() => {
            messageElement.textContent = '';
        }, 4000);
    }

    

    

    initializeMobileHeader() {
        // Handle icons in the header (search, user, cart)
        const searchButton = document.getElementById('mobile-search-button');
        const searchWrapper = document.getElementById('mobile-search-wrapper');
        const closeSearchButton = document.getElementById('close-search-button');
        const accountIcons = document.querySelectorAll('#desktop-account-icon, #mobile-account-icon');
        const cartIcon = document.getElementById('cart-icon');
        const modalPlaceholder = document.getElementById('modal-placeholder');

        // Handle search functionality
        if (searchButton && searchWrapper && closeSearchButton) {
            searchButton.addEventListener('click', () => {
                searchWrapper.classList.remove('-translate-y-full');
            });
            closeSearchButton.addEventListener('click', () => {
                searchWrapper.classList.add('-translate-y-full');
            });
        }

        // Handle cart icon functionality
        if (cartIcon) {
            cartIcon.addEventListener('click', (e) => {
                e.preventDefault();
                // Navigate to cart page
                this.navigate('/cart');
            });
        }
    }

    initializeSlider() {
        const slides = document.querySelectorAll('.slider-slide');
        if (slides.length === 0) return;
        let currentSlide = 0;
        const showSlide = (index) => {
            slides.forEach((slide, i) => {
                slide.classList.toggle('opacity-100', i === index);
                slide.classList.toggle('opacity-0', i !== index);
                slide.classList.toggle('active', i === index);
            });
            currentSlide = index;
        };
        showSlide(0);
        setInterval(() => {
            showSlide((currentSlide + 1) % slides.length);
        }, 5000);
    }

    initializeWhatsAppButton() {
        const whatsappButton = document.querySelector('button.fixed.bottom-5.right-5');
        if (whatsappButton) {
            const newButton = whatsappButton.cloneNode(true);
            if (whatsappButton.parentNode) {
                whatsappButton.parentNode.replaceChild(newButton, whatsappButton);
            }
            newButton.addEventListener('click', function (e) {
                e.preventDefault();
                var phoneNumber = '9167864208';
                var message = 'Hello, I would like to know more about your products.';
                var url = 'https://wa.me/' + phoneNumber + '?text=' + encodeURIComponent(message);
                window.open(url, '_blank');
            });
        }
    }

    initializeMobileFilters() {
        const filterSidebar = document.getElementById('filters-sidebar');
        const openFilterBtn = document.getElementById('mobile-filter-btn');
        const overlay = document.getElementById('filter-overlay');
        const closeFilterBtn = document.getElementById('close-filter-sidebar');

        const openSortBtn = document.getElementById('mobile-sort-btn');
        const sortModal = document.getElementById('mobile-sort-modal');
        const sortOptions = document.getElementById('mobile-sort-options');
        const closeSortModalBtn = document.getElementById('close-sort-modal');
        const mobileSortContainer = document.getElementById('mobile-sort-container');
        const desktopSortDropdown = document.getElementById('sort-by');

        if (!filterSidebar) return; // Only run on the products page

        const openSidebar = () => {
            filterSidebar.classList.remove('-translate-x-full');
            overlay.classList.remove('hidden');
        };
        const closeSidebar = () => {
            filterSidebar.classList.add('-translate-x-full');
            overlay.classList.add('hidden');
        };

        const openSortModal = () => {
            sortModal.classList.remove('hidden');
            sortModal.classList.add('flex');
            setTimeout(() => sortOptions.classList.remove('translate-y-full'), 10);
        };
        const closeSortModal = () => {
            sortOptions.classList.add('translate-y-full');
            setTimeout(() => {
                sortModal.classList.add('hidden');
                sortModal.classList.remove('flex');
            }, 300);
        };

        // Populate mobile sort options from the desktop dropdown
        if (desktopSortDropdown && mobileSortContainer) {
            mobileSortContainer.innerHTML = '';
            Array.from(desktopSortDropdown.options).forEach(option => {
                const button = document.createElement('button');
                button.textContent = option.textContent;
                button.className = 'w-full text-left p-3 rounded-lg hover:bg-gray-100';
                if (option.value === desktopSortDropdown.value) {
                    button.className += ' bg-accent-brown/10 text-accent-brown font-bold';
                }
                button.onclick = () => {
                    desktopSortDropdown.value = option.value;
                    desktopSortDropdown.dispatchEvent(new Event('change'));
                    closeSortModal();
                };
                mobileSortContainer.appendChild(button);
            });
        }

        openFilterBtn.addEventListener('click', openSidebar);
        overlay.addEventListener('click', closeSidebar);
        closeFilterBtn.addEventListener('click', closeSidebar);
        openSortBtn.addEventListener('click', openSortModal);
        closeSortModalBtn.addEventListener('click', closeSortModal);
    }

    // in public/assets/js/router.js

    // in public/assets/js/router.js

// public/assets/js/router.js me is function ko replace karein

async initializeProductDetailsPage() {
    const pathParts = window.location.pathname.split('/');
    const productId = pathParts[pathParts.length - 1];
    if (!productId || !window.location.pathname.startsWith('/product/')) return;

    try {
        const response = await fetch(`/api/products/${productId}`);
        if (!response.ok) throw new Error("Product not found");
        const product = await response.json();

        // Populate all text content
        document.getElementById('product-name').textContent = product.name;
        const priceContainer = document.getElementById('product-price');
        if (product.discount && product.discount > 0) {
            // Use actual MRP if available, otherwise calculate it (backward compatibility)
            const mrp = product.mrp || Math.round(product.price * 100 / (100 - product.discount));
            priceContainer.innerHTML = `
                <span class="text-3xl font-semibold text-accent-brown">₹${Number(product.price).toFixed(2)}</span>
                <span class="text-xl text-gray-500 line-through ml-2">₹${Number(mrp).toFixed(2)}</span>
                <span class="text-lg font-semibold text-green-600 bg-green-100 px-2 py-1 rounded ml-2">(${product.discount}% off)</span>
            `;
        } else {
            priceContainer.textContent = `₹${Number(product.price).toFixed(2)}`;
        }
        document.getElementById('product-short-desc').textContent = product.short_description;
        document.getElementById('description-content').innerHTML = product.long_description || '<p>No description available.</p>';
        document.getElementById('ingredients-content').innerHTML = product.ingredients || '<p>No ingredients list available.</p>';
        document.getElementById('cooking-content').innerHTML = product.how_to_use || '<p>No cooking instructions available.</p>';

        // --- NEW PHOTOSWIPE IMAGE GALLERY LOGIC ---
        const galleryContainer = document.getElementById('product-gallery');
        const allImages = [product.imageUrl, ...(product.galleryImages || [])];

        // Create the main image and thumbnail structure for PhotoSwipe
        galleryContainer.innerHTML = `
            <div id="gallery--main-image" class="pswp-gallery pswp-gallery--single-column" >
                <a href="${allImages[0]}" data-pswp-width="1200" data-pswp-height="1200" target="_blank">
                    <img id="main-product-image" src="${allImages[0]}" alt="Main product view" class="w-full h-full object-cover rounded-lg shadow-lg">
                </a>
            </div>
            <div id="gallery--thumbnails" class="grid grid-cols-5 gap-2 mt-2">
                ${allImages.map((imgSrc, index) => `
                    <a href="${imgSrc}" data-pswp-width="1200" data-pswp-height="1200" target="_blank">
                        <img src="${imgSrc}" alt="Thumbnail ${index + 1}" class="w-full h-full object-cover rounded-md border-2 border-transparent hover:border-accent-brown transition-colors">
                    </a>
                `).join('')}
            </div>
        `;

        // Initialize PhotoSwipe
        const { default: PhotoSwipeLightbox } = await import('https://cdnjs.cloudflare.com/ajax/libs/photoswipe/5.4.4/photoswipe-lightbox.esm.min.js');
        const lightbox = new PhotoSwipeLightbox({
            gallery: '#gallery--main-image, #gallery--thumbnails',
            children: 'a',
            pswpModule: () => import('https://cdnjs.cloudflare.com/ajax/libs/photoswipe/5.4.4/photoswipe.esm.min.js')
        });
        lightbox.init();

        // === YAHAN SE FINAL FUNCTIONALITY ADD KI GAYI HAI ===

        const categoryLink = document.getElementById('product-category');
        if (categoryLink) {
            categoryLink.textContent = product.category;
            categoryLink.href = `/products?category=${encodeURIComponent(product.category)}`;
        }
        
        // 1. Quantity, Buttons, and Tabs ke elements select karo
        const qtyValue = document.getElementById('qty-value');
        const addToCartBtn = document.getElementById('add-to-cart-btn');
        const buyNowBtn = document.getElementById('buy-now-btn');
        const tabButtons = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content > div');

        // 2. Quantity Selector Logic
        document.getElementById('qty-minus').addEventListener('click', () => {
            let currentQty = parseInt(qtyValue.textContent);
            if (currentQty > 1) qtyValue.textContent = currentQty - 1;
        });
        document.getElementById('qty-plus').addEventListener('click', () => {
            qtyValue.textContent = parseInt(qtyValue.textContent) + 1;
        });

        // 3. Add to Cart Button Logic (Bina pop-up ke)
        addToCartBtn.addEventListener('click', async () => {
            if (addToCartBtn.disabled) return;
            const quantity = parseInt(qtyValue.textContent);
            
            const originalText = addToCartBtn.innerHTML;
            addToCartBtn.innerHTML = 'Adding...';
            addToCartBtn.disabled = true;

            try {
                const cartResponse = await fetch('/api/cart', { credentials: 'include' });
                const cart = await cartResponse.json();
                const existingItem = (cart.items || []).find(item => item.product.toString() === productId);
                const currentQty = existingItem ? existingItem.quantity : 0;
                const newQty = currentQty + quantity;

                await this.updateCartItem(productId, newQty, this.updateCartCounter.bind(this));
                
                addToCartBtn.innerHTML = 'Added!';
                
                setTimeout(() => {
                    addToCartBtn.innerHTML = originalText;
                    addToCartBtn.disabled = false;
                }, 2000);

            } catch (error) {
                console.error("Add to cart error:", error);
                addToCartBtn.innerHTML = 'Error';
                setTimeout(() => {
                    addToCartBtn.innerHTML = originalText;
                    addToCartBtn.disabled = false;
                }, 2000);
            }
        });
        
        // 4. Buy Now Button Logic (Bina pop-up ke)
        buyNowBtn.addEventListener('click', async () => {
            const quantity = parseInt(qtyValue.textContent) || 1;
            try {
                // disable button to prevent double clicks
                buyNowBtn.disabled = true;
                // Add item to cart (or update quantity) before redirecting to checkout
                await this.updateCartItem(productId, quantity, this.updateCartCounter.bind(this));
                // navigate to checkout after cart is updated
                window.location.href = '/checkout';
            } catch (err) {
                console.error('Buy Now failed:', err);
                // still attempt navigation so user can try again
                window.location.href = '/checkout';
            } finally {
                buyNowBtn.disabled = false;
            }
        });

        // 5. Tab Switching Logic
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                // Pehle sabhi buttons se active style hatao
                tabButtons.forEach(btn => {
                    btn.classList.remove('border-accent-brown', 'text-accent-brown');
                    btn.classList.add('text-gray-500', 'border-transparent');
                });
                // Sirf click kiye gaye button par active style lagao
                button.classList.add('border-accent-brown', 'text-accent-brown');
                button.classList.remove('text-gray-500', 'border-transparent');
                
                // Sahi content dikhao
                const tabId = button.dataset.tab;
                tabContents.forEach(content => {
                    if (content.id === `${tabId}-content`) {
                        content.classList.remove('hidden');
                    } else {
                        content.classList.add('hidden');
                    }
                });
            });
        });

        // --- Related / You Might Also Like ---
        try {
            const relatedCarousel = document.getElementById('related-products-carousel');
            if (relatedCarousel && product.category) {
                // Fetch products in the same category (use the products endpoint which returns {products,...})
                const relResp = await fetch(`/api/products?category=${encodeURIComponent(product.category)}&limit=6`);
                if (relResp.ok) {
                    const relData = await relResp.json();
                    // Support both array responses (legacy search) and { products } responses
                    const relProducts = Array.isArray(relData) ? relData : (relData.products || []);
                    // Exclude the current product and limit to 6 items
                    const recommendations = (relProducts || []).filter(p => ((p.id || p._id) && (p.id || p._id).toString() !== (product.id || product._id).toString())).slice(0, 6);

                    if (!recommendations || recommendations.length === 0) {
                        relatedCarousel.innerHTML = `<p class="col-span-full text-center text-gray-500 w-full">No recommendations found.</p>`;
                    } else {
                        relatedCarousel.innerHTML = recommendations.map(p => `
                            <div class="related-product-card flex-shrink-0 w-64">
                                <div class="bg-white rounded-lg shadow-sm overflow-hidden group relative flex flex-col h-full">
                                    <a href="/product/${p.id || p._id}" class="block flex flex-col flex-grow">
                                        <div class="relative overflow-hidden h-40 bg-gray-100">
                                            <img src="${p.imageUrl || '/images/placeholder.png'}" alt="${p.name || ''}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300">
                                            ${p.discount > 0 ? `
                                                <div class="absolute top-2 left-2 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-2 py-1 rounded z-10">
                                                    ${p.discount}% OFF
                                                </div>
                                            ` : ''}
                                        </div>
                                        <div class="p-3 flex flex-col flex-grow">
                                            <div class="flex-grow">
                                                <h3 class="font-semibold text-sm text-text-primary truncate" title="${p.name || ''}">${p.name || ''}</h3>
                                                <div class="flex items-center gap-1 mt-1">
                                                    <p class="text-accent-brown font-bold text-sm whitespace-nowrap">₹${p.price || 0}</p>
                                                    ${p.discount > 0 ? `<p class="text-gray-500 line-through text-xs">₹${Math.round((p.price || 0) * 100 / (100 - (p.discount || 0)))}</p>` : ''}
                                                </div>
                                            </div>
                                            <div class="mt-2">
                                                <button class="add-to-cart-btn bg-gradient-to-r from-[#8C6A5D] to-[#73564B] text-white text-xs font-bold px-3 py-1.5 rounded-md hover:from-[#73564B] hover:to-[#8C6A5D] transition-colors w-full" data-id="${p.id || p._id}">
                                                    Add to Cart
                                                </button>
                                            </div>
                                        </div>
                                    </a>
                                </div>
                            </div>
                        `).join('');

                        // Add carousel functionality
                        const carousel = document.getElementById('related-products-carousel');
                        const prevBtn = document.getElementById('prev-related-products');
                        const nextBtn = document.getElementById('next-related-products');
                        
                        if (carousel && prevBtn && nextBtn) {
                            // Scroll the carousel by one card width
                            const scrollAmount = 260; // Approximate width of one card (w-64 = 16rem = 256px) + some margin
                            
                            nextBtn.addEventListener('click', () => {
                                carousel.scrollBy({ 
                                    left: scrollAmount, 
                                    behavior: 'smooth' 
                                });
                            });
                            
                            prevBtn.addEventListener('click', () => {
                                carousel.scrollBy({ 
                                    left: -scrollAmount, 
                                    behavior: 'smooth' 
                                });
                            });
                        }

                        if (window.AOS) setTimeout(() => AOS.refresh(), 100);
                        if (window.lucide && typeof window.lucide.createIcons === 'function') window.lucide.createIcons();
                    }
                } else {
                    relatedCarousel.innerHTML = `<p class="col-span-full text-center text-gray-500 w-full">No recommendations found.</p>`;
                }
            }
        } catch (relErr) {
            console.error('Failed to load related products:', relErr);
            const relatedCarousel = document.getElementById('related-products-carousel');
            if (relatedCarousel) relatedCarousel.innerHTML = `<p class="col-span-full text-center text-gray-500 w-full">No recommendations found.</p>`;
        }

    } catch (error) {
        console.error("Failed to load product details:", error);
        document.getElementById('main-content').innerHTML = `<p class="text-center p-20">Product not found.</p>`;
    }
}

    initializeLoginPage() {
        const loginPanel = document.getElementById('login-panel');
        if (!loginPanel) return;

        const signupPanel = document.getElementById('signup-panel');
        const forgotPanel = document.getElementById('forgot-panel');

        const showSignupBtn = document.getElementById('show-signup-btn');
        const showLoginBtnFromSignup = document.getElementById('show-login-btn-from-signup');
        const showForgotBtn = document.getElementById('show-forgot-btn');
        const showLoginBtnFromForgot = document.getElementById('show-login-btn-from-forgot');

        const signupForm = document.getElementById('signup-form');
        const loginForm = document.getElementById('login-form');
        const forgotForm = document.getElementById('forgot-form');

        const signupMessage = document.getElementById('signup-message');
        const loginMessage = document.getElementById('login-message');
        const forgotMessage = document.getElementById('forgot-message');

        const showMessage = (messageElement, text, isError = false) => {
            if (!messageElement) return;
            messageElement.innerText = text;
            messageElement.className = `text-center text-sm font-medium mb-4 h-5 ${isError ? 'text-red-500' : 'text-green-500'}`;
            if (text) {
                setTimeout(() => messageElement.innerText = '', 4000);
            }
        };

        const switchToPanel = (panelToShow) => {
            const panels = [loginPanel, signupPanel, forgotPanel];

            panels.forEach(panel => {
                panel.classList.add('transition-transform', 'duration-500', 'ease-in-out');
                if (panel !== panelToShow) {
                    panel.classList.add(panel === loginPanel ? '-translate-x-full' : 'translate-x-full');
                    panel.classList.remove('translate-x-0');
                }
            });

            panelToShow.classList.remove('-translate-x-full', 'translate-x-full');
            panelToShow.classList.add('translate-x-0');
        };

        showSignupBtn?.addEventListener('click', e => {
            e.preventDefault();
            switchToPanel(signupPanel);
        });

        showForgotBtn?.addEventListener('click', e => {
            e.preventDefault();
            switchToPanel(forgotPanel);
        });

        showLoginBtnFromSignup?.addEventListener('click', e => {
            e.preventDefault();
            switchToPanel(loginPanel);
        });

        showLoginBtnFromForgot?.addEventListener('click', e => {
            e.preventDefault();
            switchToPanel(loginPanel);
        });

        signupForm?.addEventListener('submit', async e => {
            e.preventDefault();
            // Support multiple templates that use slightly different input ids
            const fullNameEl = document.getElementById('signup-fullname') || document.getElementById('signup-name');
            const emailEl = document.getElementById('signup-email');
            const passwordEl = document.getElementById('signup-password');
            const confirmEl = document.getElementById('confirm-password') || document.getElementById('signup-confirm-password');
            const fullName = fullNameEl ? fullNameEl.value.trim() : '';
            const email = emailEl ? emailEl.value.trim() : '';
            const password = passwordEl ? passwordEl.value : '';
            const confirmPassword = confirmEl ? confirmEl.value : '';

            if (password !== confirmPassword) {
                showMessage(signupMessage, "Passwords do not match!", true);
                signupPanel.classList.add('shake');
                setTimeout(() => signupPanel.classList.remove('shake'), 500);
                return;
            }

            try {
                const response = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fullName, email, password })
                });
                const data = await response.json();
                if (response.ok) {
                    showMessage(signupMessage, "Signup successful! Redirecting to login...", false);
                    setTimeout(() => switchToPanel(loginPanel), 1500);
                } else {
                    showMessage(signupMessage, data.message, true);
                }
            } catch (error) {
                showMessage(signupMessage, "Server error. Please try again later.", true);
            }
        });

        loginForm?.addEventListener('submit', async e => {
            e.preventDefault();
            // login form submitted
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            try {
                // sending login request
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                // login response received

                const data = await response.json();
                // login data received

                if (response.ok) {
                    // login successful
                    showMessage(loginMessage, "Login Successful! Redirecting...", false);
                    localStorage.setItem('token', data.token);
                    document.dispatchEvent(new Event('loginSuccess'));
                    setTimeout(() => { this.navigate('/home'); }, 1500);
                } else {
                    // login failed
                    showMessage(loginMessage, data.message, true);
                }
            } catch (error) {
                console.error('Login error:', error);
                showMessage(loginMessage, "Server error. Please try again later.", true);
            }
        });

        forgotForm?.addEventListener('submit', async e => {
            e.preventDefault();
            
            const emailInput = forgotForm.querySelector('input[type="email"]');
            const email = emailInput?.value.trim();
            
            if (!email) {
                showMessage(forgotMessage, "Please enter your email address", true);
                return;
            }
            
            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showMessage(forgotMessage, "Please enter a valid email address", true);
                return;
            }
            
            try {
                const response = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    if (data.emailSent) {
                        let html = `
                            <div class="p-3 bg-green-50 border border-green-300 rounded-lg text-green-800 text-sm text-left">
                                <p class="font-semibold text-green-900">${data.message || 'Password reset link sent to your email!'}</p>
                                ${data.resetUrl ? `<p class="text-xs text-gray-600 mt-2">Dev quick link: <a href="${data.resetUrl}" class="underline font-bold text-accent-brown">Open Reset Page</a></p>` : ''}
                            </div>
                        `;
                        forgotMessage.innerHTML = html;
                        forgotMessage.className = 'text-center text-sm font-medium mb-4 min-h-[1.25rem]';
                    } else if (data.resetUrl) {
                        forgotMessage.innerHTML = `
                            <div class="mt-2 p-3 bg-amber-50 border border-amber-300 rounded-lg text-left">
                                <p class="text-xs text-amber-900 font-semibold mb-2">${data.message || 'Your reset link is ready:'}</p>
                                <a href="${data.resetUrl}" class="block text-center py-2 px-4 bg-gradient-to-r from-[#8C6A5D] to-[#73564B] text-white font-bold rounded-lg text-sm shadow hover:opacity-95 transition">
                                    👉 Click Here to Reset Password
                                </a>
                                <p class="text-[11px] text-gray-500 text-center mt-2">Redirecting automatically in <span id="router-countdown">3</span>s...</p>
                            </div>
                        `;
                        forgotMessage.className = 'text-center text-sm font-medium mb-4 min-h-[1.25rem]';
                        let count = 3;
                        const timer = setInterval(() => {
                            count--;
                            const el = document.getElementById('router-countdown');
                            if (el) el.textContent = count;
                            if (count <= 0) {
                                clearInterval(timer);
                                window.location.href = data.resetUrl;
                            }
                        }, 1000);
                    } else {
                        showMessage(forgotMessage, data.message || "Password reset link sent to your email!", false);
                        setTimeout(() => switchToPanel(loginPanel), 3000);
                    }
                    if (emailInput) emailInput.value = '';
                } else {
                    showMessage(forgotMessage, data.message || "Failed to send reset link", true);
                }
            } catch (error) {
                console.error('Forgot password error:', error);
                showMessage(forgotMessage, "An error occurred. Please try again.", true);
            }
        });

        // Initial state
        loginPanel.classList.add('translate-x-0');
        loginPanel.classList.remove('-translate-x-full');
    }

    setupAuthUI() {
        const accountIcons = document.querySelectorAll('#desktop-account-icon, #mobile-account-icon');
        const accountDropdown = document.getElementById('account-dropdown');
        const logoutBtn = document.getElementById('logout-btn');

        if (accountIcons.length > 0) {
            accountIcons.forEach(icon => {
                // Remove any existing event listeners to prevent conflicts
                const newIcon = icon.cloneNode(true);
                icon.parentNode.replaceChild(newIcon, icon);
                
                // Add click event listener that checks auth status when clicked
                newIcon.addEventListener('click', async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Check auth status when clicked, not just at initialization
                    const isLoggedIn = await this.checkAuthStatus();
                    
                    if (isLoggedIn) {
                        // User is logged in, toggle the dropdown
                        // First reset any custom positioning that might have been applied
                        accountDropdown.style.position = '';
                        accountDropdown.style.top = '';
                        accountDropdown.style.left = '';
                        accountDropdown.style.right = '';
                        
                        // Toggle the dropdown visibility
                        // Check if it's currently visible
                        const isCurrentlyVisible = !accountDropdown.classList.contains('hidden');
                        
                        if (isCurrentlyVisible) {
                            // If currently visible, hide it
                            accountDropdown.classList.add('hidden');
                        } else {
                            // If currently hidden, show it
                            // For desktop, use a timeout to allow the dropdown to render before positioning
                            if (newIcon.id === 'desktop-account-icon') {
                                // Temporarily show the dropdown to measure its dimensions
                                accountDropdown.classList.remove('hidden');
                                
                                // Use a timeout to allow the browser to render the dropdown first
                                setTimeout(() => {
                                    const iconRect = newIcon.getBoundingClientRect();
                                    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
                                    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                                    
                                    // Position the dropdown below the icon
                                    // With fixed positioning, coordinates are relative to viewport, not document
                                    accountDropdown.style.position = 'fixed';
                                    accountDropdown.style.top = `${iconRect.bottom + 4}px`; // 4px gap below the icon, relative to viewport
                                    accountDropdown.style.left = `${iconRect.right - accountDropdown.offsetWidth}px`;
                                }, 0);
                            } else {
                                // For mobile, just toggle the hidden class and let CSS handle positioning
                                accountDropdown.classList.remove('hidden');
                            }
                        }
                    } else {
                        // User is not logged in, navigate to login page
                        this.navigate('/login');
                    }
                });
            });
        }
        
        // Handle logout
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                try {
                    // Call server logout endpoint to clear session and JWT cookie
                    const response = await fetch('/api/auth/logout', {
                        method: 'POST',
                        credentials: 'include', // Include cookies in the request
                        headers: {
                            'Content-Type': 'application/json',
                        }
                    });
                    
                    if (response.ok) {
                        // Clear client-side token
                        localStorage.removeItem('token');
                        // Hide dropdown
                        accountDropdown.classList.add('hidden');
                        // Navigate to home
                        this.navigate('/home');
                    } else {
                        console.error('Logout failed:', response.status);
                        // Even if server logout failed, still clear client state
                        localStorage.removeItem('token');
                        accountDropdown.classList.add('hidden');
                        this.navigate('/home');
                    }
                } catch (error) {
                    console.error('Error during logout:', error);
                    // Clear client state even if network request failed
                    localStorage.removeItem('token');
                    accountDropdown.classList.add('hidden');
                    this.navigate('/home');
                }
            });
        }

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (accountDropdown && !accountDropdown.classList.contains('hidden') && 
                !accountDropdown.contains(e.target) && 
                !Array.from(accountIcons).some(icon => icon.contains(e.target))) {
                accountDropdown.classList.add('hidden');
            }
        });
    }
    
    // Function to check authentication status with the server
    async checkAuthStatus() {
        try {
            const response = await fetch('/api/auth/verify', {
                method: 'GET',
                credentials: 'include' // Include cookies in the request
            });
            return response.ok;
        } catch (error) {
            console.error('Error checking auth status:', error);
            return false;
        }
    }
    
    // Function to update header UI based on authentication status
    async updateHeaderAuthUI() {
        const isLoggedIn = await this.checkAuthStatus();
        const mobileAccountIcon = document.getElementById('mobile-account-icon');
        const desktopAccountIcon = document.getElementById('desktop-account-icon');
        const accountDropdown = document.getElementById('account-dropdown');
        
        if (mobileAccountIcon && desktopAccountIcon) {
            // If user is logged in, make the icons clickable to open dropdown
            if (isLoggedIn) {
                // For logged-in state, make them clickable to open dropdown
                // The actual dropdown functionality is handled by setupAuthUI
                // Just make sure the icons don't have login links
                if (mobileAccountIcon.getAttribute('href') === '/login') {
                    mobileAccountIcon.setAttribute('href', '#');
                }
                if (desktopAccountIcon.getAttribute('href') === '/login') {
                    desktopAccountIcon.setAttribute('href', '#');
                }
            } else {
                // For logged-out state, make the icons link to login
                if (mobileAccountIcon.getAttribute('href') !== '/login') {
                    mobileAccountIcon.setAttribute('href', '/login');
                }
                if (desktopAccountIcon.getAttribute('href') !== '/login') {
                    desktopAccountIcon.setAttribute('href', '/login');
                }
            }
        }
        
        return isLoggedIn;
    }

    async reinitializeComponents(search) { // 'search' parameter yahan aata hai
        window.scrollTo(0, 0);
        if (window.AOS) {
            window.AOS.refresh();
            window.AOS.init({ duration: 800, once: true });
        }
        if (window.lucide) {
            window.lucide.createIcons();
        }
        this.initializeSlider();
        this.initializeProductGrid();
        this.initializeCartPage();
        this.initializeProductPage(search);
        this.initializeMobileHeader();
        this.initializeMobileHeader();
        this.initializeWhatsAppButton();
        this.initializeProductDetailsPage();
        this.initializeMobileFilters(); // Aur yahan use hota hai
        this.updateCartCounter();
        this.initializeLoginPage();
        this.updateLoginState();
        this.setupAuthUI();

    }

    updateLoginState() {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                document.body.classList.add('logged-in');
            } else {
                document.body.classList.remove('logged-in');
            }

            // Support both id names used across templates
            const logoutIds = ['logout-button', 'logout-btn'];
            for (const id of logoutIds) {
                const logoutEl = document.getElementById(id);
                if (logoutEl) {
                    // Replace with clone to clear previous listeners
                    const clone = logoutEl.cloneNode(true);
                    logoutEl.parentNode.replaceChild(clone, logoutEl);
                    clone.addEventListener('click', (e) => {
                        e.preventDefault();
                        localStorage.removeItem('token');
                        this.updateLoginState();
                        this.navigate('/home');
                    });
                }
            }
        } catch (err) {
            // silent
            console.warn('updateLoginState error:', err);
        }
    }
    
    // Handle search submission
    handleSearch(e) {
        let searchTerm = '';
        
        // Determine which form was submitted based on the form element's ID
        if (e.target.id === 'search-form' || e.target.id === 'mobile-search-form') {
            // Form was submitted directly
            if (e.target.id === 'mobile-search-form') {
                searchTerm = document.getElementById('mobile-search-input') ? document.getElementById('mobile-search-input').value.trim() : '';
            } else {
                searchTerm = document.getElementById('search-input') ? document.getElementById('search-input').value.trim() : '';
            }
        } else {
            // Search was triggered by clicking the search icon or other means
            // Check both inputs and use whichever has a value
            const desktopInput = document.getElementById('search-input');
            const mobileInput = document.getElementById('mobile-search-input');
            
            if (mobileInput && mobileInput.value.trim()) {
                searchTerm = mobileInput.value.trim();
            } else if (desktopInput && desktopInput.value.trim()) {
                searchTerm = desktopInput.value.trim();
            }
        }
        
        if (searchTerm && searchTerm.length >= 2) {
            // Navigate to products page with search query (using 'q' to match backend parameter)
            const searchUrl = `/products?q=${encodeURIComponent(searchTerm)}`;
            this.navigate(searchUrl);
        }
    }

}

new SPARouter();
// SPA Router instantiated (log removed)

// Existing site scripts
// index load log removed

    try {
        if (window.lucide && typeof window.lucide.createIcons === 'function') {
            window.lucide.createIcons();
        } else if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
            lucide.createIcons();
        }
    } catch (err) {
        console.warn('lucide.createIcons() failed:', err);
    }
AOS.init({ duration: 800, once: true, offset: 50 });


window.addEventListener('scroll', () => {
    const header = document.getElementById('main-header');
    if (window.scrollY > 20) header.classList.add('header-scrolled');
    else header.classList.remove('header-scrolled');
});




// Check if mobile menu elements exist
const mobileMenuButton = document.getElementById('mobile-menu-button');
const mobileMenu = document.getElementById('mobile-menu');
// mobile menu presence logs removed

if (mobileMenuButton && mobileMenu) {
    mobileMenuButton.addEventListener('click', () => {
        // toggle mobile menu
        mobileMenu.classList.toggle('hidden');
        // Close search if menu is opened
        if (!mobileMenu.classList.contains('hidden')) {
            const searchWrapper = document.getElementById('mobile-search-wrapper');
            if (searchWrapper && !searchWrapper.classList.contains('-translate-y-full')) {
                searchWrapper.classList.add('-translate-y-full');
            }
        }
    });
} else {
    console.error('Mobile menu button or menu not found');
}

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    const mobileMenu = document.getElementById('mobile-menu');
    const menuButton = document.getElementById('mobile-menu-button');
    const mobileDropdownButton = document.getElementById('mobile-dropdown-button');
    const mobileDropdownMenu = document.getElementById('mobile-dropdown-menu');
    
    // Check if elements exist
    if (!mobileMenu || !menuButton) {
        return;
    }
    
    // If menu is open and click is outside menu and menu button
    if (!mobileMenu.classList.contains('hidden') && 
        !mobileMenu.contains(e.target) && 
        !menuButton.contains(e.target) &&
        (!mobileDropdownButton || !mobileDropdownButton.contains(e.target)) &&
        (!mobileDropdownMenu || !mobileDropdownMenu.contains(e.target))) {
        // Closing mobile menu - clicked outside
        mobileMenu.classList.add('hidden');
    }
});

document.getElementById('mobile-dropdown-button').addEventListener('click', (e) => {
    e.preventDefault();
    // Simple toggle without icon change
    const menu = document.getElementById('mobile-dropdown-menu');
    if (menu) {
        menu.classList.toggle('hidden');
    } else {
        console.error('Mobile dropdown menu not found');
    }
});

const mobileSearchButton = document.getElementById('mobile-search-button');
const mobileSearchWrapper = document.getElementById('mobile-search-wrapper');
const closeSearchButton = document.getElementById('close-search-button');
if (mobileSearchButton && mobileSearchWrapper && closeSearchButton) {
    mobileSearchButton.addEventListener('click', () => { 
        // Close mobile menu if it's open
        const mobileMenu = document.getElementById('mobile-menu');
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
        }
        mobileSearchWrapper.classList.remove('-translate-y-full'); 
    });
    closeSearchButton.addEventListener('click', () => { mobileSearchWrapper.classList.add('-translate-y-full'); });
}

// Add search functionality (init log removed)

// Add CSS for search dropdown positioning
const searchStyles = document.createElement('style');
searchStyles.textContent = `
  .search-dropdown {
    position: absolute;
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    z-index: 9999; /* Highest possible z-index */
    max-height: 400px;
    overflow-y: auto;
  }
  
  .search-dropdown.hidden {
    display: none;
  }
`;
document.head.appendChild(searchStyles);

const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const mobileSearchForm = document.getElementById('mobile-search-form');
const mobileSearchInput = document.getElementById('mobile-search-input');

// Create live search dropdown containers and append to body to escape stacking context
if (searchInput) {
    const desktopDropdown = document.createElement('div');
    desktopDropdown.id = 'desktop-search-dropdown';
    desktopDropdown.className = 'search-dropdown hidden';
    // Add to body to escape stacking context issues
    document.body.appendChild(desktopDropdown);
}

if (mobileSearchInput) {
    const mobileDropdown = document.createElement('div');
    mobileDropdown.id = 'mobile-search-dropdown';
    mobileDropdown.className = 'search-dropdown hidden';
    // Add to body to escape stacking context issues
    document.body.appendChild(mobileDropdown);
}

// Debounce function to limit API calls
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Live search function
const liveSearch = debounce(async function(searchTerm) {
    if (!searchTerm || searchTerm.trim().length < 2) {
        hideSearchDropdowns();
        return;
    }

    try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) throw new Error('Failed to search products');
        
        const products = await response.json();
        showLiveSearchResults(products, searchTerm);
    } catch (error) {
        console.error('Live search error:', error);
        hideSearchDropdowns();
    }
}, 300); // 300ms debounce

// Position the dropdown under the search input
function positionDropdown(dropdownId, inputElement) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown || !inputElement) return;
    
    const inputRect = inputElement.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Position relative to viewport and convert to page coordinates
    dropdown.style.top = `${inputRect.top + window.pageYOffset + inputRect.height}px`;
    dropdown.style.left = `${inputRect.left + window.pageXOffset}px`;
    dropdown.style.width = `${inputRect.width}px`;
    dropdown.style.position = 'absolute';
    dropdown.style.margin = '0'; // Reset any margin
}

// Show live search results in dropdown
function showLiveSearchResults(products, searchTerm) {
    // Show results in desktop dropdown
    const desktopDropdown = document.getElementById('desktop-search-dropdown');
    if (desktopDropdown && searchInput) {
        if (products && products.length > 0) {
            desktopDropdown.innerHTML = products.map(product => `
                <a href="/product/${product.id || product._id}" class="block p-3 border-b border-gray-200/30 hover:bg-gray-50 transition-colors duration-200 flex items-center" onclick="hideSearchDropdowns()">
                    <img src="${product.imageUrl}" alt="${product.name}" class="w-12 h-12 object-cover rounded mr-3 border border-gray-200">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-text-primary truncate">${product.name}</div>
                        <div class="text-sm text-accent-brown font-medium">₹${product.price}</div>
                        ${product.discount && product.discount > 0 ? `<div class="text-xs text-green-600 font-semibold">${product.discount}% OFF</div>` : ''}
                    </div>
                </a>
            `).join('');
            desktopDropdown.classList.remove('hidden');
            positionDropdown('desktop-search-dropdown', searchInput);
        } else {
            desktopDropdown.innerHTML = `<div class="p-4 text-center text-text-secondary">No products found for "${searchTerm}"</div>`;
            desktopDropdown.classList.remove('hidden');
            positionDropdown('desktop-search-dropdown', searchInput);
        }
    }

    // Show results in mobile dropdown
    const mobileDropdown = document.getElementById('mobile-search-dropdown');
    if (mobileDropdown && mobileSearchInput) {
        if (products && products.length > 0) {
            mobileDropdown.innerHTML = products.map(product => `
                <a href="/product/${product.id || product._id}" class="block p-3 border-b border-gray-200/30 hover:bg-gray-50 transition-colors duration-200 flex items-center" onclick="hideSearchDropdowns()">
                    <img src="${product.imageUrl}" alt="${product.name}" class="w-12 h-12 object-cover rounded mr-3 border border-gray-200">
                    <div class="flex-1 min-w-0">
                        <div class="font-medium text-text-primary truncate">${product.name}</div>
                        <div class="text-sm text-accent-brown font-medium">₹${product.price}</div>
                        ${product.discount && product.discount > 0 ? `<div class="text-xs text-green-600 font-semibold">${product.discount}% OFF</div>` : ''}
                    </div>
                </a>
            `).join('');
            mobileDropdown.classList.remove('hidden');
            positionDropdown('mobile-search-dropdown', mobileSearchInput);
        } else {
            mobileDropdown.innerHTML = `<div class="p-4 text-center text-text-secondary">No products found for "${searchTerm}"</div>`;
            mobileDropdown.classList.remove('hidden');
            positionDropdown('mobile-search-dropdown', mobileSearchInput);
        }
    }
}

// Hide all search dropdowns
function hideSearchDropdowns() {
    const desktopDropdown = document.getElementById('desktop-search-dropdown');
    const mobileDropdown = document.getElementById('mobile-search-dropdown');
    
    if (desktopDropdown) desktopDropdown.classList.add('hidden');
    if (mobileDropdown) mobileDropdown.classList.add('hidden');
}

// Add event listeners for live search
if (searchInput) {
    searchInput.addEventListener('input', (e) => {
        liveSearch(e.target.value);
    });
    
    // Hide dropdown when losing focus, with a small delay to allow clicks on results
    searchInput.addEventListener('blur', () => {
        setTimeout(hideSearchDropdowns, 200);
    });
    
    // Show dropdown when focusing if there's text
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim().length >= 2) {
            liveSearch(searchInput.value);
        }
    });
}

if (mobileSearchInput) {
    mobileSearchInput.addEventListener('input', (e) => {
        liveSearch(e.target.value);
    });
    
    // Hide dropdown when losing focus
    mobileSearchInput.addEventListener('blur', () => {
        setTimeout(hideSearchDropdowns, 200);
    });
    
    // Show dropdown when focusing if there's text
    mobileSearchInput.addEventListener('focus', () => {
        if (mobileSearchInput.value.trim().length >= 2) {
            liveSearch(mobileSearchInput.value);
        }
    });
}

// Reposition dropdowns on scroll and resize to maintain correct positioning
window.addEventListener('scroll', function() {
    // Only reposition if dropdowns are visible
    const desktopDropdown = document.getElementById('desktop-search-dropdown');
    const mobileDropdown = document.getElementById('mobile-search-dropdown');
    
    if (desktopDropdown && !desktopDropdown.classList.contains('hidden') && searchInput) {
        positionDropdown('desktop-search-dropdown', searchInput);
    }
    
    if (mobileDropdown && !mobileDropdown.classList.contains('hidden') && mobileSearchInput) {
        positionDropdown('mobile-search-dropdown', mobileSearchInput);
    }
});

window.addEventListener('resize', function() {
    // Reposition visible dropdowns after resize
    const desktopDropdown = document.getElementById('desktop-search-dropdown');
    const mobileDropdown = document.getElementById('mobile-search-dropdown');
    
    if (desktopDropdown && !desktopDropdown.classList.contains('hidden') && searchInput) {
        positionDropdown('desktop-search-dropdown', searchInput);
    }
    
    if (mobileDropdown && !mobileDropdown.classList.contains('hidden') && mobileSearchInput) {
        positionDropdown('mobile-search-dropdown', mobileSearchInput);
    }
});

// Search elements presence check (logs removed)

// Handle search form submission
if (searchForm) {
    // attaching submit listener to search form
    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        hideSearchDropdowns(); // Hide dropdown before showing search results on main page
        window.router.handleSearch(e);
    });
}

if (mobileSearchForm) {
    // attaching submit listener to mobile search form
    mobileSearchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        hideSearchDropdowns(); // Hide dropdown before showing search results on main page
        window.router.handleSearch(e);
    });
}




// Handle search icon clicks
document.addEventListener('DOMContentLoaded', function() {
    // Wait a bit for Lucide icons to load
    setTimeout(function() {
        // Desktop search icon
        const desktopSearchIcon = document.querySelector('#search-form i[data-lucide="search"]');
        if (desktopSearchIcon && searchInput) {
            desktopSearchIcon.addEventListener('click', function(e) {
                e.preventDefault();
                const searchTerm = searchInput.value.trim();
                if (searchTerm) {
                    if (searchTerm.length >= 2) {
                        // Trigger live search if term is long enough
                        showLiveSearchResults([], searchTerm); // Show "no results" initially
                        liveSearch(searchTerm);
                    } else {
                        // For short terms, just submit the form
                        hideSearchDropdowns();
                        window.router.handleSearch(e);
                    }
                }
            });
        }
        
        // Mobile search icon
        const mobileSearchIcon = document.querySelector('#mobile-search-form i[data-lucide="search"]');
        if (mobileSearchIcon && mobileSearchInput) {
            mobileSearchIcon.addEventListener('click', function(e) {
                e.preventDefault();
                const searchTerm = mobileSearchInput.value.trim();
                if (searchTerm) {
                    if (searchTerm.length >= 2) {
                        // Trigger live search if term is long enough
                        showLiveSearchResults([], searchTerm); // Show "no results" initially
                        liveSearch(searchTerm);
                    } else {
                        // For short terms, just submit the form
                        hideSearchDropdowns();
                        window.router.handleSearch(e);
                    }
                }
            });
        }
    }, 100);

// Function to handle search submission

});
