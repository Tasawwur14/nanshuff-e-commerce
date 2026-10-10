document.addEventListener('DOMContentLoaded', () => {
    if (window.location.pathname.endsWith('products.html') || window.location.pathname === '/products') {
        // Load categories for filters
        loadCategories();
        
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('q');
        const category = urlParams.get('category');
        
        if (searchQuery) {
            fetchAndRenderProducts(`/api/products/search?q=${encodeURIComponent(searchQuery)}`, `Search results for "${searchQuery}"`);
        } else if (category) {
            // Handle category parameter
            fetchAndRenderProducts(`/api/products?category=${encodeURIComponent(category)}`, `${category} Products`);
            // Check the corresponding category checkbox after a short delay to ensure DOM is ready
            setTimeout(() => {
                const categoryCheckbox = document.querySelector(`input[value="${category}"]`);
                if (categoryCheckbox) {
                    categoryCheckbox.checked = true;
                }
            }, 100);
        } else {
            fetchAndRenderProducts('/api/products', 'All Products');
        }
        
        // Add event listener to the Clear All button
        const clearFiltersBtn = document.getElementById('clear-filters-btn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', clearFilters);
        }

        // Mobile filter sidebar toggle
        const mobileFilterBtn = document.getElementById('mobile-filter-btn');
        const filtersSidebar = document.getElementById('filters-sidebar');
        const closeFilterSidebarBtn = document.getElementById('close-filter-sidebar');
        const filterOverlay = document.getElementById('filter-overlay');

        if (mobileFilterBtn && filtersSidebar && closeFilterSidebarBtn && filterOverlay) {
            mobileFilterBtn.addEventListener('click', () => {
                filtersSidebar.classList.remove('-translate-x-full');
                filtersSidebar.style.transform = 'translateX(0)'; // Explicitly set transform
                filtersSidebar.classList.remove('pointer-events-none');
                filterOverlay.classList.remove('hidden');
                filterOverlay.style.display = 'block'; // Explicitly set display
                filterOverlay.classList.remove('pointer-events-none');
            });

            closeFilterSidebarBtn.addEventListener('click', () => {
                filtersSidebar.classList.add('-translate-x-full');
                filtersSidebar.style.transform = 'translateX(-100%)'; // Explicitly set transform
                filtersSidebar.classList.add('pointer-events-none');
                filterOverlay.classList.add('hidden');
                filterOverlay.style.display = 'none'; // Explicitly set display
                filterOverlay.classList.add('pointer-events-none');
            });

            filterOverlay.addEventListener('click', () => {
                filtersSidebar.classList.add('-translate-x-full');
                filtersSidebar.style.transform = 'translateX(-100%)'; // Explicitly set transform
                filtersSidebar.classList.add('pointer-events-none');
                filterOverlay.classList.add('hidden');
                filterOverlay.style.display = 'none'; // Explicitly set display
                filterOverlay.classList.add('pointer-events-none');
            });
        }

        // Mobile sort modal toggle
        const mobileSortBtn = document.getElementById('mobile-sort-btn');
        const mobileSortModal = document.getElementById('mobile-sort-modal');
        const closeSortModalBtn = document.getElementById('close-sort-modal');
        const mobileSortContainer = document.getElementById('mobile-sort-container');
        const desktopSortSelect = document.getElementById('sort-by');

        if (mobileSortBtn && mobileSortModal && closeSortModalBtn && mobileSortContainer && desktopSortSelect) {
            // Populate mobile sort options from desktop select
            Array.from(desktopSortSelect.options).forEach(option => {
                const radioDiv = document.createElement('div');
                radioDiv.className = 'flex items-center';
                radioDiv.innerHTML = `
                    <input type="radio" name="mobile-sort" value="${option.value}" id="mobile-sort-${option.value}" class="mobile-sort-radio">
                    <label for="mobile-sort-${option.value}" class="ml-2">${option.text}</label>
                `;
                mobileSortContainer.appendChild(radioDiv);
            });

            // Set initial selected state for mobile sort radios
            const selectedDesktopOption = desktopSortSelect.value;
            const initialMobileRadio = document.getElementById(`mobile-sort-${selectedDesktopOption}`);
            if (initialMobileRadio) {
                initialMobileRadio.checked = true;
            }

            mobileSortBtn.addEventListener('click', () => {
                mobileSortModal.classList.remove('hidden');
                mobileSortModal.classList.add('flex'); // Use flex to center content
                setTimeout(() => {
                    mobileSortModal.querySelector('#mobile-sort-options').classList.remove('translate-y-full');
                }, 10); // Small delay for transition
            });

            closeSortModalBtn.addEventListener('click', () => {
                mobileSortModal.querySelector('#mobile-sort-options').classList.add('translate-y-full');
                setTimeout(() => {
                    mobileSortModal.classList.add('hidden');
                    mobileSortModal.classList.remove('flex');
                }, 300); // Match transition duration
            });

            mobileSortModal.addEventListener('click', (event) => {
                if (event.target === mobileSortModal) { // Clicked on overlay, not the modal content
                    mobileSortModal.querySelector('#mobile-sort-options').classList.add('translate-y-full');
                    setTimeout(() => {
                        mobileSortModal.classList.add('hidden');
                        mobileSortModal.classList.remove('flex');
                    }, 300);
                }
            });

            // Handle change on mobile sort radio buttons
            mobileSortContainer.addEventListener('change', (event) => {
                if (event.target.classList.contains('mobile-sort-radio')) {
                    desktopSortSelect.value = event.target.value;
                    desktopSortSelect.dispatchEvent(new Event('change')); // Trigger change on desktop select
                    closeSortModalBtn.click(); // Close modal after selection
                }
            });
        }
    }
});

async function loadCategories() {
    try {
        const response = await fetch('/api/categories');
        if (!response.ok) {
            throw new Error('Failed to fetch categories');
        }
        const categories = await response.json();
        renderCategoryFilters(categories);
    } catch (error) {
        console.error('Error loading categories:', error);
        document.getElementById('category-filters-container').innerHTML = '<p class="text-sm text-red-500">Error loading categories</p>';
    }
}

function renderCategoryFilters(categories) {
    const container = document.getElementById('category-filters-container');
    if (!categories || categories.length === 0) {
        container.innerHTML = '<p class="text-sm text-gray-500">No categories available</p>';
        return;
    }

    const categoryHTML = categories.map(category => {
        const id = `category-${category}`;
        return `
            <div class="flex items-center">
                <input type="checkbox" name="category" value="${category}" id="${id}" class="category-checkbox">
                <label for="${id}" class="ml-2">${category}</label>
            </div>
        `;
    }).join('');

    container.innerHTML = categoryHTML;

    // Add event listeners to category checkboxes
    document.querySelectorAll('.category-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            applyFilters();
        });
    });
}

// Function to apply filters
function applyFilters() {
    console.log('Filters applied');
    // Build query string from all current filter selections
    const params = new URLSearchParams();
    
    // Get selected categories
    const selectedCategories = Array.from(document.querySelectorAll('.category-checkbox:checked')).map(cb => cb.value);
    if (selectedCategories.length > 0) {
        params.append('category', selectedCategories.join(','));
    }
    
    // Get availability selection
    const availability = document.querySelector('input[name="availability"]:checked').value;
    if (availability !== 'all') {
        params.append('availability', availability);
    }
    
    // Get dietary selection
    const dietary = document.querySelector('input[name="dietary"]:checked').value;
    if (dietary !== '') {
        params.append('dietary', dietary);
    }
    
    // Build the URL with all parameters
    let url = '/api/products';
    if (params.toString()) {
        url += '?' + params.toString();
    }
    
    fetchAndRenderProducts(url, 'Filtered Products');
}

// Function to clear all filters
function clearFilters() {
    console.log('Clearing all filters');
    
    // Uncheck all category checkboxes
    document.querySelectorAll('.category-checkbox').forEach(checkbox => {
        checkbox.checked = false;
    });
    
    // Reset availability radio buttons to "All" (the default)
    const allAvailabilityRadio = document.getElementById('avail-all');
    if (allAvailabilityRadio) {
        allAvailabilityRadio.checked = true;
    }
    
    // Reset discount radio buttons to "Any" (the default)
    const anyDiscountRadio = document.getElementById('disc-any');
    if (anyDiscountRadio) {
        anyDiscountRadio.checked = true;
    }
    
    // Reset dietary radio buttons to "All" (the default)
    const allDietaryRadio = document.getElementById('diet-all');
    if (allDietaryRadio) {
        allDietaryRadio.checked = true;
    }
    
    // Reset price slider to default values if it exists
    const priceSlider = document.getElementById('price-slider');
    if (priceSlider && typeof noUiSlider !== 'undefined' && priceSlider.noUiSlider) {
        // Reset to full range [0, 10000] as shown in the EJS template
        priceSlider.noUiSlider.set([0, 10000]);
    }
    
    // After clearing filters, apply the default (no filter) state to refresh products
    fetchAndRenderProducts('/api/products', 'All Products');
}

async function fetchAndRenderProducts(url, title) {
    const productGrid = document.getElementById('product-grid');
    const productCount = document.getElementById('product-count');
    const paginationContainer = document.getElementById('pagination-container');

    if (!productGrid || !productCount) return;

    productGrid.innerHTML = '<p class="col-span-full text-center pt-20">Loading products...</p>';
    productCount.textContent = 'Loading...';
    if (paginationContainer) paginationContainer.innerHTML = '';

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Failed to fetch products');
        }
        const data = await response.json();
        // The main /api/products returns { products: [], pagination info }
        // The /api/products/search returns an array directly
        // So check if data is an array or an object with a products property
        const products = Array.isArray(data) ? data : (data.products || []);
        renderProductGrid(products, title);
    } catch (error) {
        console.error('Error fetching products:', error);
        productGrid.innerHTML = '<p class="col-span-full text-center pt-20 text-red-500">Error: Could not load products.</p>';
        productCount.textContent = 'Error';
    }
}

function renderProductGrid(products, title) {
    const productGrid = document.getElementById('product-grid');
    const productCount = document.getElementById('product-count');
    const pageTitle = document.querySelector('main .text-3xl');

    if (pageTitle) {
        pageTitle.textContent = title;
    }

    if (!products || products.length === 0) {
        productGrid.innerHTML = '<p class="col-span-full text-center pt-20">No products found.</p>';
        productCount.textContent = '0 products found';
        return;
    }

    const productHTML = products.map(product => {
        const name = product.name || 'Unnamed Product';
        const price = product.price || 'N/A';
        const description = product.description || product.short_description || '';
        const imageUrl = product.imageUrl || 'https://placehold.co/400x400/?text=Image';
        // Use id for Sequelize-based models or _id for MongoDB-based models
        const productId = product.id || product._id || '';
        // Determine if product is featured, check discount if available
        const isFeatured = product.featured || false;
        const discount = product.discount || 0;
        
        return `
        <div class="bg-white rounded-lg shadow-md overflow-hidden group relative flex flex-col h-full" data-aos="fade-up">
            <div class="relative overflow-hidden group">
                <a href="/product/${productId}">
                    <img src="${imageUrl}" alt="${name}" class="w-full h-64 object-cover group-hover:scale-110 transition-transform duration-500">
                    <div class="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </a>
                <!-- Badges -->
                <div class="absolute top-2 left-2">
                    ${isFeatured ? '<span class="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">Featured</span>' : ''}
                </div>
                <div class="absolute bottom-3 left-3">
                    ${discount > 0 ? `<div class="bg-gradient-to-r from-red-500 to-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg z-10 shadow-lg">${discount}% OFF</div>` : ''}
                </div>
                <div class="absolute top-2 right-2">
                    <button class="wishlist-btn w-8 h-8 bg-white/80 rounded-full flex items-center justify-center hover:bg-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart">
                            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="p-6 flex flex-col flex-grow">
                <a href="/product/${productId}">
                    <h3 class="text-xl font-semibold mb-2">${name}</h3>
                </a>
                <p class="text-text-secondary text-sm mb-4">${description ? description.substring(0, 100) : ''}...</p>
                <div class="flex flex-wrap items-center gap-2 mb-4">
                    <span class="text-2xl font-bold text-accent-brown">₹${Number(price).toFixed(2)}</span>
                    ${product.mrp && product.mrp > 0 && product.discount > 0 && product.mrp !== price ? `<span class="text-lg text-gray-500 line-through">₹${Number(product.mrp).toFixed(2)}</span>` : ''}
                    ${product.discount > 0 ? `<span class="text-sm font-semibold text-green-600 bg-green-100 px-2 py-1 rounded">(${product.discount}% off)</span>` : ''}
                </div>
                <button class="add-to-cart-btn bg-gradient-to-r from-[#8C6A5D] to-[#73564B] text-white px-4 py-2 rounded-md hover:from-[#73564B] hover:to-[#8C6A5D] transition-colors duration-300 mt-auto" data-product-id="${productId}">Add to Cart</button>
            </div>
        </div>`;
    }).join('');

    productGrid.innerHTML = productHTML;
    productCount.textContent = `${products.length} products found`;

    AOS.refresh();
    
    // Initialize Lucide icons after rendering
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Add event listener using event delegation for dynamically created buttons
    productGrid.addEventListener('click', (event) => {
        if (event.target.classList.contains('add-to-cart-btn')) {
            const button = event.target;
            const productId = button.dataset.productId;
            addToCart(productId);
        }
    });
    
    // Add event listeners for wishlist buttons
    productGrid.querySelectorAll('.wishlist-btn').forEach(button => {
        button.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            // Toggle heart icon state
            const icon = this.querySelector('i');
            if (icon) {
                const isFilled = this.classList.contains('bg-red-100');
                if (isFilled) {
                    this.classList.remove('bg-red-100');
                    icon.setAttribute('data-lucide', 'heart');
                } else {
                    this.classList.add('bg-red-100');
                    icon.setAttribute('data-lucide', 'heart');
                }
                // Reinitialize the icon
                if (typeof lucide !== 'undefined') {
                    lucide.createIcons();
                }
            }
        });
    });
}

async function addToCart(productId) {
    console.log('Adding product to cart:', productId);
    const button = document.querySelector(`button[data-product-id="${productId}"]`);
    
    if (button) {
        // Temporarily update the UI to show the user that the action is happening
        const originalText = button.textContent;
        button.textContent = 'Adding...';
        button.disabled = true;
        
        try {
            // Make API call to add product to cart
            const response = await fetch('/api/cart', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    productId: productId,
                    quantity: 1  // Adding 1 of the product
                })
            });
            
            if (response.ok) {
                button.textContent = 'Added!';
                
                // Update cart counter if it exists
                updateCartCounter();
                
                // Reset button after delay
                setTimeout(() => {
                    button.textContent = 'Add to Cart';
                    button.disabled = false;
                }, 2000);
            } else {
                const errorData = await response.json();
                console.error('Error adding to cart:', errorData.message);
                button.textContent = originalText;
                button.disabled = false;
                alert(`Error adding to cart: ${errorData.message}`);
            }
        } catch (error) {
            console.error('Error adding product to cart:', error);
            button.textContent = originalText;
            button.disabled = false;
            alert('Error adding to cart. Please try again.');
        }
    }
}

async function updateCartCounter() {
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
        // Don't show error to user, just log it
    }
}
