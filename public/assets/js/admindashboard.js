// =================================================================
// --- UTILITY FUNCTIONS ---
// =================================================================
const getStatusBadgeClass = (status) => {
    const statusMap = {
        'pending': 'bg-yellow-100 text-yellow-800',
        'processing': 'bg-blue-100 text-blue-800',
        'shipped': 'bg-purple-100 text-purple-800',
        'delivered': 'bg-green-100 text-green-800',
        'cancelled': 'bg-red-100 text-red-800'
    };
    return statusMap[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
};

const getPaymentStatusBadgeClass = (status) => {
    const statusMap = {
        'pending': 'bg-yellow-100 text-yellow-800',
        'completed': 'bg-green-100 text-green-800',
        'failed': 'bg-red-100 text-red-800'
    };
    return statusMap[status?.toLowerCase()] || 'bg-gray-100 text-gray-800';
};

document.addEventListener('DOMContentLoaded', () => {
    // =================================================================
    // --- GLOBAL STATE & SETUP ---
    // =================================================================
    // We use cookie-based httpOnly token authentication. Ensure the server-set cookie is present
    // by letting the browser send cookies with requests (credentials: 'include'). Do not use localStorage.
    const getAuthHeaders = () => ({ 'Content-Type': 'application/json' });
    const fetchWithAuth = (url, opts = {}) => {
        return fetch(url, { credentials: 'include', headers: { ...(opts.headers || {}), ...getAuthHeaders() }, ...opts });
    };

    // Global fetch wrapper for admin UI
    // - Ensures same-origin API requests include credentials (cookies)
    // - Automatically redirects to /adminlogin when server returns 401 (expired/invalid token)
    // This avoids leaving the admin UI visible with no data when the token has expired.
    (function installGlobalFetchWrapper() {
        if (!window || !window.fetch) return;
        const origFetch = window.fetch.bind(window);
        window.fetch = async function(input, init = {}) {
            try {
                // Resolve URL string for checks
                const urlStr = typeof input === 'string' ? input : (input && input.url) || '';

                // If this is a same-origin API request, add credentials unless already provided
                const isApiCall = urlStr.startsWith('/api/') || urlStr.startsWith('/api') || urlStr.startsWith(window.location.origin + '/api');
                if (isApiCall) {
                    init = Object.assign({ credentials: 'include' }, init);
                    // IMPORTANT: Only add Content-Type header if NOT using FormData
                    // FormData should NOT have Content-Type header set - browser must handle it
                    if (!(init.body instanceof FormData)) {
                        init.headers = Object.assign({}, init.headers || {}, getAuthHeaders());
                    }
                }

                const resp = await origFetch(input, init);

                if (resp && resp.status === 401) {
                    // Token expired or invalid. Redirect to admin login so user doesn't remain on broken UI.
                    // Small timeout to let any pending tasks finish; then navigate.
                    setTimeout(() => {
                        window.location.href = '/adminlogin';
                    }, 100);
                }

                return resp;
            } catch (err) {
                return Promise.reject(err);
            }
        };
    })();
    let allProducts = [];
    let productLookupMap = new Map(); // For O(1) product lookup by id
    let galleryFiles = [];

    // =================================================================
    // --- DOM ELEMENT DEFINITIONS ---
    // =================================================================
    const sidebarNav = document.getElementById('sidebar-nav');
    const headerTitle = document.getElementById('header-title');
    const pages = document.querySelectorAll('main[id^="page-"]');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('sidebar');
    const logoutBtn = document.getElementById('logout-btn');
    const settingsLinkFromProfile = document.getElementById('settings-link-from-profile');
    const notificationBtn = document.getElementById('notification-btn');
    const notificationDropdown = document.getElementById('notification-dropdown');
    const userMenuBtn = document.getElementById('user-menu-btn');
    const userDropdown = document.getElementById('user-dropdown');
    const productsTableBody = document.getElementById('products-table-body');
    const addProductBtn = document.getElementById('add-product-btn');
    const productModal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');
    const productModalTabs = document.getElementById('product-modal-tabs');
    const productTabContents = document.querySelectorAll('.product-tab-content');
    const closeProductModalBtn = document.getElementById('close-product-modal-btn');
    const cancelProductBtn = document.getElementById('cancel-product-btn');
    const productSearchInput = document.getElementById('product-search');
    const categoryFilterSelect = document.getElementById('product-category-filter');
    const productCategorySelect = document.getElementById('product-category-select');
    const newCategoryInput = document.getElementById('new-category-input');
    const customersTableBody = document.getElementById('customers-table-body');
    const refreshCustomersBtn = document.getElementById('refresh-customers-btn');
    const profileModal = document.getElementById('profile-modal');
    const profileLink = document.getElementById('profile-link');
    const closeProfileModalBtn = document.getElementById('close-profile-modal-btn');
    const profileInfoForm = document.getElementById('profile-info-form');
    const profilePasswordForm = document.getElementById('profile-password-form');
    const uploadMainImageBtn = document.getElementById('upload-main-image-btn');
    const mainImageInput = document.getElementById('main-image-input');
    const mainImagePreview = document.getElementById('main-image-preview');
    const uploadGalleryImagesBtn = document.getElementById('upload-gallery-images-btn');
    const galleryImagesInput = document.getElementById('gallery-images-input');
    const galleryImagesPreview = document.getElementById('gallery-images-preview');
    const uploadVideoBtn = document.getElementById('upload-video-btn');
    const productVideoInput = document.getElementById('product-video-input');
    const videoPreview = document.getElementById('video-preview');
    const productMrpInput = document.getElementById('product-mrp');
    const productDiscountInput = document.getElementById('product-discount');
    const productPriceInput = document.getElementById('product-price');
    let profileModalContent = profileModal ? profileModal.querySelector('.modal-content') : null;

    // =================================================================
    // --- MODAL MANAGEMENT HELPER ---
    // =================================================================
    // Generic function to setup modal close handlers
    // This ensures all modals (including dynamically created ones) handle close properly
    const setupModalCloseHandler = (modalId, closeButtonId = null) => {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        // Default close button ID follows pattern: "close-{modalId}-btn"
        const btnId = closeButtonId || `close-${modalId}-btn`;
        const closeBtn = document.getElementById(btnId);

        if (!closeBtn) {
            console.warn(`Close button not found: ${btnId}`);
            return;
        }

        // Function to close the modal
        const closeModal = () => {
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.classList.add('scale-95', 'opacity-0');
            }
            setTimeout(() => {
                modal.classList.add('hidden');
                // Restore scrolling on the body when closing the order modal
                if (modalId === 'order-modal') {
                    document.body.style.overflow = '';
                }
            }, 300);
        };

        // Remove old listeners to prevent duplicates
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);

        // Add fresh event listeners
        newCloseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeModal();
        });

        // Also close on ESC key
        const escKeyHandler = (e) => {
            if (e.key === 'Escape' && !modal.classList.contains('hidden')) {
                closeModal();
            }
        };
        document.removeEventListener('keydown', escKeyHandler);
        document.addEventListener('keydown', escKeyHandler);

        // Also close when clicking outside the modal
        const outsideClickHandler = (e) => {
            if (e.target === modal && !modal.classList.contains('hidden')) {
                closeModal();
            }
        };
        modal.removeEventListener('click', outsideClickHandler);
        modal.addEventListener('click', outsideClickHandler);

        console.log(`Modal close handler set up for: ${modalId}`);
    };


    // =================================================================
    // --- NAVIGATION & HEADER ---
    // =================================================================
    sidebarNav.addEventListener('click', (e) => {
        const link = e.target.closest('.sidebar-link');
        if (!link) return;
        e.preventDefault();
        const pageId = link.dataset.page;
        sidebarNav.querySelector('.active').classList.remove('active');
        link.classList.add('active');
        pages.forEach(page => page.classList.toggle('hidden', page.id !== `page-${pageId}`));
        headerTitle.textContent = link.querySelector('span').textContent;
    });
    sidebarToggle.addEventListener('click', () => sidebar.classList.toggle('-translate-x-full'));
    
    // Add close button functionality
    const sidebarCloseBtn = document.getElementById('sidebar-close-btn');
    if (sidebarCloseBtn) {
        sidebarCloseBtn.addEventListener('click', () => {
            sidebar.classList.add('-translate-x-full');
        });
    }
    
    // Add click outside to close sidebar functionality
    document.addEventListener('click', (e) => {
        // Close sidebar if click is outside sidebar and sidebar is open
        if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
            if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
                sidebar.classList.add('-translate-x-full');
            }
        }
    });
    logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
            await fetchWithAuth('/api/auth/logout', { method: 'POST' });
        } catch (e) {
            // ignore errors on logout
        }
        window.location.href = '/adminlogin';
    });
    notificationBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        userDropdown.classList.add('hidden', 'opacity-0');
        notificationDropdown.classList.toggle('hidden');
        notificationDropdown.classList.toggle('opacity-0');
    });
    userMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationDropdown.classList.add('hidden', 'opacity-0');
        userDropdown.classList.toggle('hidden');
        userDropdown.classList.toggle('opacity-0');
    });
    document.addEventListener('click', () => {
        notificationDropdown.classList.add('hidden', 'opacity-0');
        userDropdown.classList.add('hidden', 'opacity-0');
    });

    // =================================================================
    // --- MODAL & FORM HELPERS ---
    // =================================================================
    const openProfileModal = async () => {
        try {
            // Fetch the current admin profile data
            const response = await fetch('/api/auth/admin/profile', { 
                method: 'GET', 
                headers: { 
                    'Content-Type': 'application/json',
                    ...getAuthHeaders() 
                }
            });
            
            if (!response.ok) {
                // Try to get error message from response
                let errorMessage = 'Failed to fetch profile data';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    // If JSON parsing fails, use status text
                    errorMessage = response.statusText || errorMessage;
                }
                throw new Error(errorMessage);
            }
            
            const profileData = await response.json();
            
            // Populate the form fields with the retrieved data
            document.getElementById('profile-username').value = profileData.username || '';
            document.getElementById('profile-name').value = profileData.fullName || '';
            document.getElementById('profile-email').value = profileData.email || '';
            
            // Show the modal
            profileModal.classList.remove('hidden');
            setTimeout(() => { 
                if(profileModalContent) profileModalContent.classList.remove('scale-95', 'opacity-0'); 
            }, 10);
        } catch (error) {
            console.error('Error fetching profile data:', error);
            alert('Error loading profile data: ' + error.message);
        }
    };
    const closeProfileModal = () => {
        if(profileModalContent) profileModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => { profileModal.classList.add('hidden'); }, 300);
    };
    const openProductModal = async (mode = 'add', product = null) => {
        // Reset form and UI elements first
        productForm.reset();
        galleryFiles = [];
        renderGalleryPreviews();
        mainImagePreview.src = 'https://placehold.co/100x100';
        document.getElementById('product-id').value = '';
        productModalTabs.querySelector('.active').classList.remove('active');
        productModalTabs.querySelector('[data-tab="product-general"]').classList.add('active');
        productTabContents.forEach(c => c.classList.add('hidden'));
        document.getElementById('tab-product-general').classList.remove('hidden');
        newCategoryInput.classList.add('hidden'); // Hide new category input by default

        // Set modal title early
        document.getElementById('modal-title').textContent = mode === 'edit' ? 'Edit Product' : 'Add New Product';

        // Show the modal immediately without waiting for data
        productModal.classList.remove('hidden');
        setTimeout(() => { 
            const modalContent = productModal.querySelector('.modal-content');
            if (modalContent) {
                modalContent.classList.remove('scale-95', 'opacity-0');
            }
        }, 10);

        // Populate form fields for edit mode
        if (mode === 'edit' && product) {
            // Support both SQL (id) and MongoDB (_id)
            document.getElementById('product-id').value = product.id || product._id;
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-sku').value = product.sku;
            productMrpInput.value = product.mrp;
            productDiscountInput.value = product.discount;
            productPriceInput.value = product.price;
            document.getElementById('product-stock').value = product.stock;
            document.getElementById('product-status').value = product.status;
            document.getElementById('short-description').value = product.short_description;
            document.getElementById('long-description').value = product.long_description;
            document.getElementById('ingredients').value = product.ingredients;
            document.getElementById('how-to-use').value = product.how_to_use;
            document.getElementById('product-tags').value = product.tags;
            document.getElementById('product-featured').checked = product.featured || false; // Set featured checkbox
            mainImagePreview.src = product.imageUrl || 'https://placehold.co/100x100';
        }

        // Calculate selling price early
        calculateSellingPrice();

        // Load categories in the background without blocking UI
        const populateCategories = async (selectedCategory) => {
            try {
                const response = await fetch('/api/products/filters');
                const data = await response.json();
                const categories = data.categories || [];

                // Use a document fragment for better performance when adding multiple options
                const fragment = document.createDocumentFragment();
                
                categories.forEach(cat => {
                    const option = document.createElement('option');
                    option.value = cat;
                    option.textContent = cat;
                    fragment.appendChild(option);
                });

                const addNewOption = document.createElement('option');
                addNewOption.value = '__add_new__';
                addNewOption.textContent = '+ Add New Category';
                fragment.appendChild(addNewOption);

                // Replace all options at once for better performance
                productCategorySelect.innerHTML = '';
                productCategorySelect.appendChild(fragment);

                if (selectedCategory) {
                    productCategorySelect.value = selectedCategory;
                }
                
                // Ensure change handler runs so new-category input visibility/required state is correct
                try {
                    productCategorySelect.dispatchEvent(new Event('change'));
                } catch (e) {
                    // ignore
                }
            } catch (error) {
                console.error('Failed to load categories:', error);
            }
        };

        // Call populateCategories after showing the modal
        await populateCategories(mode === 'edit' && product ? product.category : null);
    };
    const closeProductModal = () => {
        const productModalContent = productModal.querySelector('.modal-content');
        productModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => { productModal.classList.add('hidden'); }, 300);
    };
    const calculateSellingPrice = () => {
        const mrp = parseFloat(productMrpInput.value) || 0;
        const discount = parseFloat(productDiscountInput.value) || 0;
        productPriceInput.value = (mrp * (1 - discount / 100)).toFixed(2);
    };

    // =================================================================
    // --- PROFILE LOGIC ---
    // =================================================================
    profileLink.addEventListener('click', (e) => { e.preventDefault(); openProfileModal(); userDropdown.classList.add('hidden', 'opacity-0'); });
    settingsLinkFromProfile.addEventListener('click', (e) => { e.preventDefault(); document.querySelector('.sidebar-link[data-page="settings"]').click(); userDropdown.classList.add('hidden', 'opacity-0'); });
    closeProfileModalBtn.addEventListener('click', closeProfileModal);
    profileModal.addEventListener('click', (e) => { if (e.target === profileModal) closeProfileModal(); });
    profileInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('profile-username').value;
        const fullName = document.getElementById('profile-name').value;
        const email = document.getElementById('profile-email').value;
        try {
            const response = await fetch('/api/auth/admin/profile', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ username, fullName, email }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            alert('Profile updated successfully!');
        } catch (error) { alert(`Error updating profile: ${error.message}`); }
    });
    profilePasswordForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const oldPassword = document.getElementById('profile-old-password').value;
        const newPassword = document.getElementById('profile-new-password').value;
        const confirmPassword = document.getElementById('profile-confirm-password').value;
        if (newPassword !== confirmPassword) return alert('New password and confirm password do not match.');
        if (!newPassword || newPassword.length < 6) return alert('New password must be at least 6 characters long.');
        try {
            const response = await fetch('/api/auth/admin/change-password', { method: 'PUT', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, body: JSON.stringify({ oldPassword, newPassword }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            alert('Password updated successfully!');
            profilePasswordForm.reset();
        } catch (error) { alert(`Error updating password: ${error.message}`); }
    });

    // =================================================================
    // --- PRODUCT LOGIC ---
    // =================================================================
    const populateCategoryFilter = () => {
        if (!allProducts) return;
        // Use either the explicit category string or the joined categoryDetails.name when available
        const categories = ['All Categories', ...new Set(allProducts.map(p => (p.category || (p.categoryDetails && p.categoryDetails.name))).filter(Boolean))];
        categoryFilterSelect.innerHTML = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    };
    const displayProducts = () => {
        if (!allProducts) return;
        const searchTerm = productSearchInput.value.toLowerCase();
        const selectedCategory = categoryFilterSelect.value || 'All Categories';
        const filteredProducts = allProducts.filter(p => {
            const nameMatch = (p.name || '').toLowerCase().includes(searchTerm);
            const skuMatch = (p.sku || '').toLowerCase().includes(searchTerm);
            const categoryMatch = (selectedCategory === 'All Categories' || p.category === selectedCategory);
            return (nameMatch || skuMatch) && categoryMatch;
        });
        productsTableBody.innerHTML = '';
        if (filteredProducts.length === 0) {
            productsTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-gray-400">No products found.</td></tr>`;
            return;
        }
        filteredProducts.forEach(p => {
            const row = document.createElement('tr');
            row.className = 'table-row border-t border-gray-700';
            const productId = p.id || p._id; // Support both SQL (id) and MongoDB (_id)
            // Defensive category display: prefer explicit category, then joined categoryDetails.name
            const displayCategory = p.category || (p.categoryDetails && p.categoryDetails.name) || '';
            const displayImage = p.imageUrl || 'https://placehold.co/40x40';
            const displayPrice = (Number(p.price) || 0).toFixed(2);
            row.innerHTML = `
                <td class="p-4 flex items-center"><img src="${displayImage}" class="w-10 h-10 rounded-md mr-4 object-cover"><div><div class="font-medium text-text-primary flex items-center">${p.name}${p.featured ? '<i data-lucide="star" class="w-4 h-4 text-yellow-500 ml-2"></i>' : ''}</div><div class="text-sm text-gray-400 md:hidden">${p.sku}</div></div></td>
                <td class="p-4 hidden md:table-cell">${displayCategory}</td>
                <td class="p-4 hidden lg:table-cell">₹${displayPrice}</td>
                <td class="p-4 hidden lg:table-cell">${p.stock}</td>
                <td class="p-4"><span class="status-badge status-${(p.status || '').toLowerCase().replace(' ','')}">${p.status}</span>${p.featured ? '<span class="ml-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">Featured</span>' : ''}</td>
                <td class="p-4"><button data-id="${productId}" class="edit-btn text-blue-400 hover:underline mr-4">Edit</button><button data-id="${productId}" class="delete-btn text-red-400 hover:underline">Delete</button></td>`;
            productsTableBody.appendChild(row);
        });
        
        // Refresh lucide icons for the featured stars
        if (window.lucide) {
            window.lucide.createIcons();
        }
    };
    const fetchProductsAndRender = async () => {
        try {
            productsTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-gray-400">Loading products...</td></tr>`;
            
            // Try admin endpoint first, fallback to public endpoint
            let response = await fetch('/api/products/admin/all', { 
                headers: getAuthHeaders(),
                credentials: 'include'
            });
            
            // If admin endpoint fails (e.g., auth issue), try public endpoint
            if (!response.ok) {
                console.log('Admin endpoint failed, trying public endpoint');
                response = await fetch('/api/products?limit=100&page=1', { 
                    headers: getAuthHeaders(),
                    credentials: 'include'
                });
            }
            
            if (!response.ok) throw new Error(`Could not fetch products (${response.status})`);
            const data = await response.json();
            allProducts = data.products || [];
            
            // Build product lookup map for O(1) access
            productLookupMap.clear();
            allProducts.forEach(product => {
                if (product.id) productLookupMap.set(product.id.toString(), product);
                if (product._id) productLookupMap.set(product._id.toString(), product);
            });
            
            populateCategoryFilter();
            setTimeout(displayProducts, 0); // Use setTimeout to ensure DOM is ready
        } catch (error) {
            console.error('Failed to fetch products:', error);
            productsTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-red-400">Error loading products: ${error.message}</td></tr>`;
        }
    };

    productCategorySelect.addEventListener('change', () => {
        if (productCategorySelect.value === '__add_new__') {
            newCategoryInput.classList.remove('hidden');
            newCategoryInput.required = true; // require new category when adding
            newCategoryInput.focus();
        } else {
            newCategoryInput.classList.add('hidden');
            newCategoryInput.required = false;
            newCategoryInput.value = '';
        }
    });

    productModalTabs.addEventListener('click', (e) => {
        const button = e.target.closest('.tab-button');
        if (button) {
            const tabId = button.dataset.tab;
            productModalTabs.querySelector('.active').classList.remove('active');
            button.classList.add('active');
            productTabContents.forEach(content => content.classList.toggle('hidden', content.id !== `tab-${tabId}`));
        }
    });
    const removeMainImageBtn = document.getElementById('remove-main-image-btn');

    // Add event listeners only if elements exist
    if (uploadMainImageBtn && mainImageInput && mainImagePreview && removeMainImageBtn) {
        uploadMainImageBtn.addEventListener('click', () => mainImageInput.click());
        mainImageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) { 
                const reader = new FileReader(); 
                reader.onload = (event) => { 
                    mainImagePreview.src = event.target.result; 
                    removeMainImageBtn.classList.remove('hidden');
                }; 
                reader.readAsDataURL(file); 
            }
        });

        removeMainImageBtn.addEventListener('click', () => {
            mainImageInput.value = ''; // Clear the file input
            mainImagePreview.src = 'https://placehold.co/100x100'; // Reset preview
            removeMainImageBtn.classList.add('hidden'); // Hide the button
        });
    } else {
        console.warn('⚠️ Main image upload elements not found:', {
            uploadMainImageBtn: !!uploadMainImageBtn,
            mainImageInput: !!mainImageInput,
            mainImagePreview: !!mainImagePreview,
            removeMainImageBtn: !!removeMainImageBtn
        });
    }

    if (uploadGalleryImagesBtn && galleryImagesInput) {
        uploadGalleryImagesBtn.addEventListener('click', () => galleryImagesInput.click());
    }

    const renderGalleryPreviews = () => {
        if (!galleryImagesPreview) return;
        galleryImagesPreview.innerHTML = '';
        galleryFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const el = document.createElement('div');
                el.className = 'relative';
                el.innerHTML = `
                    <img src="${event.target.result}" class="w-24 h-24 object-cover rounded-md">
                    <button type="button" data-index="${index}" class="gallery-remove-btn absolute top-0 right-0 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">&times;</button>
                `;
                galleryImagesPreview.appendChild(el);
            };
            reader.readAsDataURL(file);
        });
    };

    if (galleryImagesInput) {
        galleryImagesInput.addEventListener('change', (e) => {
            for (const file of e.target.files) {
                galleryFiles.push(file);
            }
            renderGalleryPreviews();
        });
    }

    if (galleryImagesPreview) {
        galleryImagesPreview.addEventListener('click', (e) => {
            if (e.target.classList.contains('gallery-remove-btn')) {
                const index = parseInt(e.target.dataset.index, 10);
                galleryFiles.splice(index, 1);
                renderGalleryPreviews();
            }
        });
    }
    const removeVideoBtn = document.getElementById('remove-video-btn');

    if (uploadVideoBtn && productVideoInput && videoPreview && removeVideoBtn) {
        uploadVideoBtn.addEventListener('click', () => productVideoInput.click());
        productVideoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) { 
                const reader = new FileReader(); 
                reader.onload = (event) => { 
                    const source = videoPreview.querySelector('source'); 
                    source.src = event.target.result; 
                    videoPreview.load(); 
                    removeVideoBtn.classList.remove('hidden');
                }; 
                reader.readAsDataURL(file); 
            }
        });

        removeVideoBtn.addEventListener('click', () => {
            productVideoInput.value = '';
            const source = videoPreview.querySelector('source');
            source.src = '';
            videoPreview.load();
            removeVideoBtn.classList.add('hidden');
        });
    } else {
        console.warn('⚠️ Video upload elements not found:', {
            uploadVideoBtn: !!uploadVideoBtn,
            productVideoInput: !!productVideoInput,
            videoPreview: !!videoPreview,
            removeVideoBtn: !!removeVideoBtn
        });
    }

    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('product-id').value;

        // Basic client-side validation: required fields
        const requiredFields = [
            { el: document.getElementById('product-name'), name: 'Product Name' },
            { el: document.getElementById('product-sku'), name: 'SKU' },
            { el: document.getElementById('short-description'), name: 'Short Description' },
            { el: document.getElementById('long-description'), name: 'Long Description' },
            { el: document.getElementById('ingredients'), name: 'Ingredients' },
            { el: document.getElementById('how-to-use'), name: 'How to Use' },
            { el: document.getElementById('product-mrp'), name: 'MRP' },
            { el: document.getElementById('product-discount'), name: 'Discount' },
            { el: document.getElementById('product-stock'), name: 'Quantity' },
            { el: document.getElementById('product-status'), name: 'Stock Status' },
        ];

        for (const field of requiredFields) {
            if (!field.el) continue;
            const value = field.el.value;
            if (value === undefined || value === null || String(value).trim() === '') {
                // If the element is inside a hidden product tab, activate that tab first
                const tabContent = field.el.closest('.product-tab-content');
                if (tabContent && tabContent.classList.contains('hidden')) {
                    // Hide others and show this
                    productTabContents.forEach(c => c.classList.add('hidden'));
                    tabContent.classList.remove('hidden');
                    // Activate matching tab button
                    const dataTab = tabContent.id.replace('tab-', ''); // e.g., product-general
                    const button = productModalTabs.querySelector(`[data-tab="${dataTab}"]`);
                    if (button) {
                        productModalTabs.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
                        button.classList.add('active');
                    }
                    // allow layout then focus
                    setTimeout(() => field.el.focus(), 60);
                } else {
                    field.el.focus();
                }
                alert(`${field.name} is required.`);
                return;
            }
        }

        // Image is optional - allow product creation without image
        // if (!id && mainImageInput.files.length === 0) {
        //     alert('Main image is required for a new product.');
        //     uploadMainImageBtn.focus();
        //     return;
        // }

        const formData = new FormData();

        let categoryValue = productCategorySelect.value || '__add_new__';
        if (categoryValue === '__add_new__') {
            categoryValue = newCategoryInput.value.trim();
            if (!categoryValue) {
                alert('Please enter a name for the new category.');
                newCategoryInput.focus();
                return;
            }
        }

        formData.append('name', document.getElementById('product-name').value);
        formData.append('sku', document.getElementById('product-sku').value);
        formData.append('category', categoryValue);
        formData.append('weight', document.getElementById('product-weight').value);
        formData.append('mrp', productMrpInput.value);
        formData.append('discount', productDiscountInput.value);
        formData.append('price', productPriceInput.value);
        formData.append('stock', document.getElementById('product-stock').value);
        formData.append('status', document.getElementById('product-status').value);
        formData.append('featured', document.getElementById('product-featured').checked); // Add featured field
        formData.append('tags', document.getElementById('product-tags').value);
        formData.append('short_description', document.getElementById('short-description').value);
        formData.append('long_description', document.getElementById('long-description').value);
        formData.append('ingredients', document.getElementById('ingredients').value);
        formData.append('how_to_use', document.getElementById('how-to-use').value);

        if (mainImageInput.files[0]) {
            formData.append('imageUrl', mainImageInput.files[0]);
        }
        if (galleryFiles.length > 0) {
            for (const file of galleryFiles) {
                formData.append('galleryImages', file);
            }
        }
        if (productVideoInput.files[0]) {
            formData.append('videoUrl', productVideoInput.files[0]);
        }

        const url = id ? `/api/products/update/${id}` : '/api/products/add';
        const method = id ? 'PUT' : 'POST';

        try {
            // For FormData with files, do NOT set Content-Type header - let browser handle it
            // Must include credentials for cookie-based auth
            const response = await fetch(url, { 
                method, 
                body: formData, 
                credentials: 'include'
                // DO NOT set headers when using FormData - browser needs to set Content-Type: multipart/form-data
            });
            if (!response.ok) {
                const errorData = await response.json();
                // Include server-provided error details (if any) to aid debugging in production
                const serverMessage = errorData.message || 'Failed to save product';
                const serverDetail = errorData.error || errorData.errors || '';
                const detailText = serverDetail ? ` — ${typeof serverDetail === 'string' ? serverDetail : JSON.stringify(serverDetail)}` : '';
                throw new Error(serverMessage + detailText);
            }
            closeProductModal();
            fetchProductsAndRender();
        } catch (error) {
            console.error("Error saving product:", error);
            alert(`Error: ${error.message}`);
        }
    });

    productsTableBody.addEventListener('click', async (e) => {
        // Find the closest element with data-id attribute
        const targetWithId = e.target.closest('[data-id]');
        if (!targetWithId) return;
        
        const id = targetWithId.dataset.id;
        if (!id) return;
        
        if (targetWithId.classList.contains('edit-btn')) {
            // Look up product by ID using the optimized map (O(1) lookup)
            let product = productLookupMap.get(id);
            
            // If not found directly by id, search by both id and _id for compatibility
            if (!product) {
                product = allProducts.find(p => {
                    const matchesId = (p.id && p.id.toString()) === id.toString();
                    const matches_Id = (p._id && p._id.toString()) === id.toString();
                    return matchesId || matches_Id;
                });
            }
            
            if (product) {
                openProductModal('edit', product);
            } else {
                console.error('Product not found for edit:', id, 'in allProducts array:', allProducts);
                alert('Error: Product not found for editing. Please refresh the page and try again.');
            }
        }
        if (targetWithId.classList.contains('delete-btn')) {
            if (confirm('Are you sure you want to delete this product?')) {
                try {
                    await fetch(`/api/products/delete/${id}`, { 
                        method: 'DELETE', 
                        headers: getAuthHeaders(),
                        credentials: 'include'
                    });
                    // Remove from both the array and lookup map
                    allProducts = allProducts.filter(p => {
                        const notIdMatch = !(p.id && p.id.toString() === id.toString());
                        const not_IdMatch = !(p._id && p._id.toString() === id.toString());
                        return notIdMatch && not_IdMatch;
                    });
                    // Remove from lookup map
                    productLookupMap.delete(id);
                    displayProducts();
                } catch (error) { 
                    console.error('Delete error:', error);
                    alert('Failed to delete product.'); 
                }
            }
        }
    });

    productSearchInput.addEventListener('input', displayProducts);
    categoryFilterSelect.addEventListener('change', displayProducts);
    addProductBtn.addEventListener('click', () => openProductModal('add'));
    closeProductModalBtn.addEventListener('click', closeProductModal);
    cancelProductBtn.addEventListener('click', closeProductModal);
    productMrpInput.addEventListener('input', calculateSellingPrice);
    productDiscountInput.addEventListener('input', calculateSellingPrice);

    // =================================================================
    // --- CUSTOMER LOGIC ---
    // =================================================================
    const renderCustomersTable = async () => {
        try {
            customersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-gray-400">Loading customers...</td></tr>`;
            const response = await fetch('/api/auth/users', { headers: getAuthHeaders() });
            if (!response.ok) {
                if (response.status === 401) {
                    // Try to show the server-provided message for easier debugging
                    let errMsg = 'Session expired. Please log in again.';
                    try { const errData = await response.json(); if (errData && errData.message) errMsg = errData.message; } catch (e) {}
                    alert(errMsg);
                    return;
                }
                throw new Error('Could not fetch customers.');
            }
            const users = await response.json();
            customersTableBody.innerHTML = '';
            if (users.length === 0) {
                customersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-gray-400">No customers found.</td></tr>`;
                return;
            }
            users.forEach(user => {
                const row = document.createElement('tr');
                row.className = 'table-row border-t border-gray-700';
                const joinDate = new Date(user.createdAt).toLocaleDateString();
                row.innerHTML = `
                    <td class="p-4 font-medium">${user.name || 'N/A'}</td>
                    <td class="p-4">${user.email}</td>
                    <td class="p-4">${joinDate}</td>
                    <td class="p-4 text-center">N/A</td>
                    <td class="p-4">N/A</td>
                    <td class="p-4"><button data-id="${user.id || user._id}" class="view-customer-btn text-yellow-400 hover:underline">View History</button></td>`;
                customersTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Failed to fetch customers:', error);
            customersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-red-400">Error loading customers.</td></tr>`;
        }
    };
    refreshCustomersBtn.addEventListener('click', renderCustomersTable);
    
    // =================================================================
    // --- DISCOUNT CODE LOGIC ---
    // =================================================================
    const discountsTableBody = document.getElementById('discounts-table-body');
    const addDiscountBtn = document.getElementById('add-discount-btn');
    const discountModal = document.getElementById('discount-modal');
    const discountForm = document.getElementById('discount-form');
    const closeDiscountModalBtn = document.getElementById('close-discount-modal-btn');
    const cancelDiscountBtn = document.getElementById('cancel-discount-btn');
    let allDiscounts = [];

    const renderDiscountsTable = async () => {
        try {
            discountsTableBody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-gray-400">Loading discount codes...</td></tr>`;
            const response = await fetch('/api/coupons', { headers: getAuthHeaders() });
            if (!response.ok) {
                if (response.status === 401) {
                    let errMsg = 'Session expired. Please log in again.';
                    try { const errData = await response.json(); if (errData && errData.message) errMsg = errData.message; } catch (e) {}
                    alert(errMsg);
                    return;
                }
                throw new Error('Could not fetch discount codes.');
            }
            const discounts = await response.json();
            allDiscounts = discounts;
            discountsTableBody.innerHTML = '';
            if (discounts.length === 0) {
                discountsTableBody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-gray-400">No discount codes found.</td></tr>`;
                return;
            }
            discounts.forEach(discount => {
                const row = document.createElement('tr');
                row.className = 'table-row border-t border-gray-700';
                const status = discount.isActive ? 'Active' : 'Inactive';
                const statusClass = discount.isActive ? 'status-active' : 'status-inactive';
                row.innerHTML = `
                    <td class="p-4 font-medium">${discount.code}</td>
                    <td class="p-4">${discount.discount}%</td>
                    <td class="p-4"><span class="status-badge ${statusClass}">${status}</span></td>
                    <td class="p-4">
                        <button data-id="${discount.id}" class="edit-discount-btn text-blue-400 hover:underline mr-4">Edit</button>
                        <button data-id="${discount.id}" class="delete-discount-btn text-red-400 hover:underline">Delete</button>
                    </td>`;
                discountsTableBody.appendChild(row);
            });
        } catch (error) {
            console.error('Failed to fetch discount codes:', error);
            discountsTableBody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-red-400">Error loading discount codes.</td></tr>`;
        }
    };

    const openDiscountModal = (mode = 'add', discount = null) => {
        document.getElementById('discount-id').value = '';
        document.getElementById('discount-code').value = '';
        document.getElementById('discount-percent').value = '';
        document.getElementById('discount-status').value = 'Active';
        
        if (mode === 'edit' && discount) {
            document.getElementById('discount-modal-title').textContent = 'Edit Discount Code';
            document.getElementById('discount-id').value = discount.id;
            document.getElementById('discount-code').value = discount.code;
            document.getElementById('discount-percent').value = discount.discount;
            document.getElementById('discount-status').value = discount.isActive ? 'Active' : 'Inactive';
        } else {
            document.getElementById('discount-modal-title').textContent = 'Create Discount Code';
        }
        
        discountModal.classList.remove('hidden');
        setTimeout(() => { 
            discountModal.querySelector('.modal-content').classList.remove('scale-95', 'opacity-0'); 
        }, 10);
    };

    const closeDiscountModal = () => {
        const discountModalContent = discountModal.querySelector('.modal-content');
        discountModalContent.classList.add('scale-95', 'opacity-0');
        setTimeout(() => { discountModal.classList.add('hidden'); }, 300);
    };

    discountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('discount-id').value;
        const code = document.getElementById('discount-code').value.toUpperCase();
        const discountPercent = document.getElementById('discount-percent').value;
        const isActive = document.getElementById('discount-status').value === 'Active';
        
        if (!code || !discountPercent) {
            return alert('Please enter a discount code and percentage.');
        }
        
        if (isNaN(discountPercent) || discountPercent <= 0 || discountPercent > 100) {
            return alert('Please enter a valid discount percentage (1-100).');
        }
        
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/coupons/${id}` : '/api/coupons';
        
        try {
            const response = await fetch(url, {
                method,
                headers: { 
                    'Content-Type': 'application/json', 
                    ...getAuthHeaders() 
                },
                body: JSON.stringify({
                    code,
                    discountType: 'percentage', // Fixed type for now
                    discountValue: parseFloat(discountPercent),
                    isActive
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to save discount code');
            }
            
            closeDiscountModal();
            renderDiscountsTable(); // Refresh the discount codes table
        } catch (error) {
            console.error("Error saving discount:", error);
            alert(`Error: ${error.message}`);
        }
    });

    discountsTableBody.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (!id) return;
        
        if (e.target.classList.contains('edit-discount-btn')) {
            const discount = allDiscounts.find(d => d.id.toString() === id);
            if (discount) openDiscountModal('edit', discount);
        }
        
        if (e.target.classList.contains('delete-discount-btn')) {
            if (confirm('Are you sure you want to delete this discount code?')) {
                try {
                    const numericId = parseInt(id, 10); // Ensure proper ID format for API
                    const response = await fetch(`/api/coupons/${numericId}`, { 
                        method: 'DELETE', 
                        headers: getAuthHeaders() 
                    });
                    
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.message || 'Failed to delete discount code');
                    }
                    
                    renderDiscountsTable(); // Refresh the discount codes table
                } catch (error) {
                    console.error('Failed to delete discount:', error);
                    alert('Failed to delete discount code.');
                }
            }
        }
    });

    addDiscountBtn.addEventListener('click', () => openDiscountModal('add'));
    closeDiscountModalBtn.addEventListener('click', closeDiscountModal);
    cancelDiscountBtn.addEventListener('click', closeDiscountModal);
    
    // Initialize discount codes table when marketing page is opened
    document.querySelector('.sidebar-link[data-page="marketing"]').addEventListener('click', (e) => {
        e.preventDefault();
        // After the page change happens, load the discounts
        setTimeout(() => {
            if (!document.getElementById('page-marketing').classList.contains('hidden')) {
                renderDiscountsTable();
            }
        }, 100);
    });

    // =================================================================
    // --- DASHBOARD METRICS ---
    // =================================================================
    const renderDashboardMetrics = async () => {
        try {
            const response = await fetch('/api/analytics/dashboard', { 
                headers: getAuthHeaders() 
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch dashboard metrics');
            }
            
            const metrics = await response.json();
            
            // Update the dashboard statistics
            document.getElementById('dashboard-revenue').textContent = `₹${(Number(metrics.totalRevenue) || 0).toFixed(2)}`;
            document.getElementById('dashboard-orders').textContent = metrics.newOrdersCount || 0;
            document.getElementById('dashboard-customers').textContent = metrics.newCustomersCount || 0;
            
            // Calculate conversion rate (simplified calculation)
            const conversionRate = metrics.newOrdersCount > 0 && metrics.newCustomersCount > 0 
                ? (metrics.newOrdersCount / metrics.newCustomersCount * 100).toFixed(2) 
                : 0;
            document.getElementById('dashboard-conversion').textContent = `${conversionRate}%`;
            
            // Render sales chart
            renderSalesChart();
            
        } catch (error) {
            console.error('Error fetching dashboard metrics:', error);
            // Update with error message or default values
            document.getElementById('dashboard-revenue').textContent = 'N/A';
            document.getElementById('dashboard-orders').textContent = 'N/A';
            document.getElementById('dashboard-customers').textContent = 'N/A';
            document.getElementById('dashboard-conversion').textContent = 'N/A';
        }
    };
    
    // Function to render sales chart (using Chart.js)
    const renderSalesChart = async () => {
        try {
            const response = await fetch('/api/analytics/sales?period=monthly', { 
                headers: getAuthHeaders() 
            });
            
            if (!response.ok) {
                throw new Error('Failed to fetch sales data');
            }
            
            const salesData = await response.json();
            
            // Prepare data for Chart.js
            const labels = salesData.salesData.map(item => item._id);
            const data = salesData.salesData.map(item => parseFloat(item.totalSales || 0));
            
            // Get the canvas element
            const ctx = document.getElementById('salesChart');
            if (!ctx) {
                console.error('Sales chart canvas not found');
                return;
            }
            
            // Destroy existing chart if it exists (support stored instance or Chart.getChart)
            try {
                if (window.salesChart && typeof window.salesChart.destroy === 'function') {
                    window.salesChart.destroy();
                } else if (typeof Chart?.getChart === 'function') {
                    const existing = Chart.getChart(ctx);
                    if (existing && typeof existing.destroy === 'function') existing.destroy();
                }
            } catch (destroyErr) {
                console.warn('Failed to destroy previous sales chart:', destroyErr);
            }
            
            // Create new chart
            window.salesChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Sales (₹)',
                        data: data,
                        borderColor: '#8C6A5D',
                        backgroundColor: 'rgba(140, 106, 93, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: function(value) {
                                    return '₹' + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error rendering sales chart:', error);
        }
    };
    
    // Add event listener to dashboard link to load metrics when dashboard is viewed
    document.querySelector('.sidebar-link[data-page="dashboard"]').addEventListener('click', (e) => {
        e.preventDefault();
        // After the page change happens, load the dashboard metrics
        setTimeout(() => {
            if (!document.getElementById('page-dashboard').classList.contains('hidden')) {
                renderDashboardMetrics();
            }
        }, 100);
    });
    
    // =================================================================
    // --- ORDERS MANAGEMENT ---
    // =================================================================
    const ordersTableBody = document.getElementById('orders-table-body');
    
    const renderOrdersTable = async (page = 1) => {
        try {
            ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-gray-400">Loading orders...</td></tr>`;
            
            const response = await fetch(`/api/orders?page=${page}&limit=10`, { 
                headers: getAuthHeaders(),
                credentials: 'include'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to fetch orders (${response.status})`);
            }
            
            const result = await response.json();
            const orders = result.orders;
            
            ordersTableBody.innerHTML = '';
            
            if (orders.length === 0) {
                ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-gray-400">No orders found.</td></tr>`;
                return;
            }
            
            orders.forEach(order => {
                const row = document.createElement('tr');
                row.className = 'table-row border-t border-gray-700';
                
                // Format the date
                const orderDate = new Date(order.createdAt).toLocaleDateString();
                
                // Create status badge with appropriate styling
                const statusClass = order.status.toLowerCase().replace(' ', '');
                const statusBadge = `<span class="status-badge status-${statusClass}">${order.status}</span>`;
                
                // Get customer name (with fallback)
                const customerName = order.shippingAddress ? order.shippingAddress.fullName : 'Guest User';
                
                row.innerHTML = `
                    <td class="p-4 font-medium">#${order.id}</td>
                    <td class="p-4">${customerName}</td>
                    <td class="p-4">${orderDate}</td>
                    <td class="p-4">₹${(Number(order.totalAmount) || 0).toFixed(2)}</td>
                    <td class="p-4">${statusBadge}</td>
                    <td class="p-4">
                        <button data-id="${order.id}" class="view-order-btn text-blue-400 hover:underline mr-4">View</button>
                        <button data-id="${order.id}" data-status="${order.status}" class="update-status-btn text-yellow-400 hover:underline">Update</button>
                    </td>
                `;
                ordersTableBody.appendChild(row);
            });
            
            // Add event listeners to the new buttons
            document.querySelectorAll('.view-order-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const orderId = e.target.dataset.id;
                    viewOrderDetails(orderId);
                });
            });
            
            document.querySelectorAll('.update-status-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const orderId = e.target.dataset.id;
                    const currentStatus = e.target.dataset.status;
                    updateOrderStatus(orderId, currentStatus);
                });
            });
            
        } catch (error) {
            console.error('Error fetching orders:', error);
            ordersTableBody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-red-400">Error loading orders: ${error.message}</td></tr>`;
        }
    };
    
    const viewOrderDetails = async (orderId) => {
        try {
            const response = await fetch(`/api/orders/${orderId}`, { 
                headers: getAuthHeaders(),
                credentials: 'include'
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to fetch order details');
            }
            
            const order = await response.json();
            
            // CRITICAL FIX: Parse shippingAddress if it's a JSON string (production DB issue)
            if (typeof order.shippingAddress === 'string') {
                try {
                    order.shippingAddress = JSON.parse(order.shippingAddress);
                } catch (e) {
                    console.error('Failed to parse order.shippingAddress:', e);
                    order.shippingAddress = null;
                }
            }
            
            // Ensure order.items is an array (handle JSON string or already parsed)
            if (typeof order.items === 'string') {
                try {
                    order.items = JSON.parse(order.items);
                } catch (e) {
                    console.error('Failed to parse order.items:', e);
                    order.items = [];
                }
            }
            if (!Array.isArray(order.items)) {
                order.items = [];
            }
            
            // Format order items for display
            const orderItemsHTML = order.items.map(item => `
                <div class="flex justify-between py-2 border-b border-gray-200">
                    <div class="flex items-center">
                        ${item.product?.imageUrl ? 
                            `<img src="${item.product.imageUrl}" alt="${item.product.name}" class="w-12 h-12 object-cover rounded mr-3 border border-gray-200">` : 
                            `<div class="w-12 h-12 bg-gray-200 rounded mr-3 flex items-center justify-center border border-gray-200">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                            </div>`
                        }
                        <div>
                            <p class="font-medium">${item.product?.name || 'N/A'}</p>
                            <p class="text-sm text-gray-500">Qty: ${item.quantity}</p>
                            <p class="text-sm text-gray-500">Price: ₹${Number(item.price || 0).toFixed(2)}</p>
                        </div>
                    </div>
                    <p class="font-medium">₹${(Number(item.price || 0) * item.quantity).toFixed(2)}</p>
                </div>
            `).join('');
            
            // Set the modal content
            const modalTitle = document.getElementById('order-modal-title');
            const modalBody = document.getElementById('order-modal-body');
            
            modalTitle.textContent = `Order Details #${order.id}`;
            
            modalBody.innerHTML = `
                <div class="flex-1 overflow-y-auto max-h-[calc(90vh-250px)] p-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <h3 class="font-semibold mb-3 text-lg border-b pb-2">Customer Information</h3>
                            <div class="space-y-2">
                                <p><span class="text-gray-500 font-medium">Name:</span> <span class="font-semibold">${order.shippingAddress?.fullName || 'N/A'}</span></p>
                                <p><span class="text-gray-500 font-medium">Email:</span> <span>${order.shippingAddress?.email || 'N/A'}</span></p>
                                <p><span class="text-gray-500 font-medium">Phone:</span> <span class="font-semibold">${order.shippingAddress?.phone || 'N/A'}</span></p>
                                <p><span class="text-gray-500 font-medium">Address:</span> <span class="block text-sm mt-1 p-2 bg-gray-50 rounded border border-gray-200">${order.shippingAddress?.address || 'N/A'}<br>${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} ${order.shippingAddress?.postalCode || ''}<br>${order.shippingAddress?.country || ''}</span></p>
                                <p><span class="text-gray-500 font-medium">Order Date:</span> <span>${new Date(order.createdAt).toLocaleString()}</span></p>
                            </div>
                        </div>
                        <div>
                            <h3 class="font-semibold mb-3 text-lg border-b pb-2">Order Information</h3>
                            <div class="space-y-2">
                                <p><span class="text-gray-500 font-medium">Status:</span> <span id="order-status-display" class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${getStatusBadgeClass(order.status)}">${order.status}</span></p>
                                <p><span class="text-gray-500 font-medium">Payment Status:</span> <span class="inline-block px-3 py-1 rounded-full text-sm font-semibold ${getPaymentStatusBadgeClass(order.paymentStatus)}">${order.paymentStatus || 'N/A'}</span></p>
                                <p><span class="text-gray-500 font-medium">Payment Method:</span> <span class="font-semibold">${order.paymentMethod?.toUpperCase() || 'N/A'}</span></p>
                                <p><span class="text-gray-500 font-medium">Total Amount:</span> <span class="text-lg font-bold text-green-600">₹${(Number(order.totalAmount) || 0).toFixed(2)}</span></p>
                                <p><span class="text-gray-500 font-medium">Coupon Applied:</span> <span>${order.coupon || 'None'}</span></p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="mt-6">
                        <h3 class="font-semibold mb-3">Order Items</h3>
                        <div class="bg-gray-50 p-4 rounded-lg">
                            ${orderItemsHTML}
                            <div class="flex justify-between pt-3 font-semibold border-t border-gray-300">
                                <p>Total:</p>
                                <p>₹${(Number(order.totalAmount) || 0).toFixed(2)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            
            // Show the modal
            const orderModal = document.getElementById('order-modal');
            const orderModalContent = orderModal.querySelector('.modal-content');
            
            // Add responsive fixed dimensions with scrollable content
            orderModalContent.classList.remove('w-full', 'max-w-3xl');
            orderModalContent.classList.add('w-full', 'max-w-4xl', 'h-full', 'max-h-[90vh]', 'overflow-hidden', 'flex', 'flex-col');
            
            // Prevent background scrolling when modal is open
            document.body.style.overflow = 'hidden';
            
            orderModal.classList.remove('hidden');
            setTimeout(() => {
                orderModalContent.classList.remove('scale-95', 'opacity-0');
            }, 10);
            
            // Re-setup close handler when modal is shown to ensure it's active
            setupModalCloseHandler('order-modal', 'close-order-modal-btn');
            
            // Add event listener for status update button in the modal
            const updateStatusBtn = document.getElementById('update-order-status-btn');
            if (updateStatusBtn) {
                updateStatusBtn.onclick = () => updateOrderStatusFromModal(order.id);
            }
            
            // Add print button functionality
            const printBtn = document.createElement('button');
            printBtn.id = 'print-order-btn';
            printBtn.className = 'login-btn bg-gradient-to-r from-[#8C6A5D] to-[#73564B] text-white font-bold py-2 px-4 rounded-lg mr-4';
            printBtn.innerHTML = '<i data-lucide="printer" class="w-5 h-5 mr-2"></i>Print Order';
            printBtn.onclick = () => printOrderDetails(order);
            
            // Add the print button to the modal footer
            const modalFooter = orderModal.querySelector('.bg-gray-100');
            if (modalFooter) {
                // Clear existing print button if any
                const existingPrintBtn = modalFooter.querySelector('#print-order-btn');
                if (existingPrintBtn) {
                    existingPrintBtn.remove();
                }
                
                // Ensure proper footer styling
                modalFooter.classList.add('p-4', 'bg-gray-100', 'flex', 'flex-wrap', 'items-center', 'justify-between', 'gap-4', 'border-t', 'border-gray-200');
                
                // Add print button before the status update section
                modalFooter.insertBefore(printBtn, modalFooter.firstChild);
                
                // Reinitialize lucide icons for the new button
                if (window.lucide) {
                    lucide.createIcons();
                }
            }
            
        } catch (error) {
            console.error('Error viewing order details:', error);
            alert('Error loading order details: ' + error.message);
        }
    };
    
    const updateOrderStatus = async (orderId, currentStatus) => {
        // Prompt for new status
        const statusOptions = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        const newStatus = prompt(
            `Current status: ${currentStatus}\n\nChoose new status:\n${statusOptions.join('\n')}\n\nEnter status:`,
            currentStatus
        );
        
        if (!newStatus) return; // User cancelled
        
        if (!statusOptions.includes(newStatus)) {
            alert('Invalid status. Please choose from: ' + statusOptions.join(', '));
            return;
        }
        
        if (newStatus === currentStatus) {
            alert('Status is the same as current status.');
            return;
        }
        
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Failed to update order status');
            }
            
            alert('Order status updated successfully!');
            
            // Refresh the orders table
            renderOrdersTable();
            
            // If order modal is open, update the status there too
            const statusDisplay = document.getElementById('order-status-display');
            if (statusDisplay) {
                statusDisplay.textContent = newStatus;
                
                // Update the status badge class
                const statusBadge = statusDisplay.parentElement.querySelector('.status-badge');
                if (statusBadge) {
                    const statusClass = newStatus.toLowerCase().replace(' ', '');
                    statusBadge.className = `status-badge status-${statusClass}`;
                    statusBadge.textContent = newStatus;
                }
            }
            
        } catch (error) {
            console.error('Error updating order status:', error);
            alert('Error updating order status: ' + error.message);
        }
    };
    
    const updateOrderStatusFromModal = async (orderId) => {
        const statusSelect = document.getElementById('order-status-update');
        const newStatus = statusSelect.value;
        
        try {
            const response = await fetch(`/api/orders/${orderId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...getAuthHeaders()
                },
                credentials: 'include',
                body: JSON.stringify({ status: newStatus })
            });
            
            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.message || 'Failed to update order status');
            }
            
            alert('Order status updated successfully!');
            
            // Update the status in the modal
            const statusDisplay = document.getElementById('order-status-display');
            if (statusDisplay) {
                statusDisplay.textContent = newStatus;
                
                // Update the status badge class
                const statusBadge = statusDisplay.parentElement.querySelector('.status-badge');
                if (statusBadge) {
                    const statusClass = newStatus.toLowerCase().replace(' ', '');
                    statusBadge.className = `status-badge status-${statusClass}`;
                    statusBadge.textContent = newStatus;
                }
            }
            
            // Refresh the orders table
            renderOrdersTable();
            
        } catch (error) {
            console.error('Error updating order status:', error);
            alert('Error updating order status: ' + error.message);
        }
    };
    
    // Function to print order details
    const printOrderDetails = (order) => {
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        
        // Ensure order.items is an array (handle JSON string or already parsed)
        let itemsArray = order.items;
        if (typeof itemsArray === 'string') {
            try {
                itemsArray = JSON.parse(itemsArray);
            } catch (e) {
                console.error('Failed to parse order.items in print:', e);
                itemsArray = [];
            }
        }
        if (!Array.isArray(itemsArray)) {
            itemsArray = [];
        }
        
        // Generate the order details HTML
        const orderItemsHTML = itemsArray.map(item => `
            <tr>
                <td class="border px-4 py-2">${item.product?.name || 'N/A'}</td>
                <td class="border px-4 py-2 text-center">${item.quantity}</td>
                <td class="border px-4 py-2 text-right">₹${(Number(item.price) || 0).toFixed(2)}</td>
                <td class="border px-4 py-2 text-right">₹${(Number(item.price) * item.quantity).toFixed(2)}</td>
            </tr>
        `).join('');
        
        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Order #${order.id} - ${order.shippingAddress?.fullName || 'N/A'}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    @media print {
                        body { -webkit-print-color-adjust: exact; color-adjust: exact; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body class="bg-white text-black">
                <div class="container mx-auto p-6">
                    <div class="flex justify-between items-start mb-8">
                        <div>
                            <h1 class="text-3xl font-bold text-gray-800">Order Details</h1>
                            <p class="text-gray-600">Order ID: #${order.id}</p>
                            <p class="text-gray-600">Date: ${new Date(order.createdAt).toLocaleString()}</p>
                        </div>
                        <div class="text-right">
                            <h2 class="text-xl font-semibold">Nanshhuf.com</h2>
                            <p class="text-gray-600 ml-4">Shop Number 5, Building Number 4, Monarch Qureshi bldg, Veera Desai Rd, </p>
                            <p class="text-gray-600 ml-4">behind EVERSHINE COSMIC, Veera Desai Industrial Estate,</p>
                            <p class="text-gray-600 ml-4">Jogeshwari West, Mumbai, Maharashtra 400102</p>
                            <p class="text-gray-600 mt-2 ml-4">Contact: +91 9167864208</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                        <div>
                            <h3 class="text-lg font-semibold mb-3">Customer Information</h3>
                            <p><span class="font-medium">Name:</span> ${order.shippingAddress?.fullName || 'N/A'}</p>
                            <p><span class="font-medium">Email:</span> ${order.shippingAddress?.email || 'N/A'}</p>
                            <p><span class="font-medium">Phone:</span> ${order.shippingAddress?.phone || 'N/A'}</p>
                            <div class="mt-2">
                                <p class="font-medium">Shipping Address:</p>
                                <p class="text-justify">${order.shippingAddress?.address || 'N/A'}</p>
                                <p class="text-justify">${order.shippingAddress?.city || ''}, ${order.shippingAddress?.state || ''} ${order.shippingAddress?.postalCode || ''}</p>
                                <p class="text-justify">${order.shippingAddress?.country || ''}</p>
                            </div>
                        </div>
                        <div>
                            <h3 class="text-lg font-semibold mb-3">Order Information</h3>
                            <p><span class="font-medium">Status:</span> ${order.status}</p>
                            <p><span class="font-medium">Payment Status:</span> ${order.paymentStatus || 'N/A'}</p>
                            <p><span class="font-medium">Payment Method:</span> ${order.paymentMethod || 'N/A'}</p>
                            <p><span class="font-medium">Subtotal:</span> ₹${(Number(order.subtotal) || 0).toFixed(2)}</p>
                            <p><span class="font-medium">Discount:</span> ₹${(Number(order.discountAmount) || 0).toFixed(2)} (${(Number(order.discountPercentage) || 0).toFixed(2)}%)</p>
                            <p><span class="font-medium">Total Amount:</span> ₹${(Number(order.totalAmount) || 0).toFixed(2)}</p>
                            <p><span class="font-medium">Coupon:</span> ${order.coupon || 'None'}</p>
                        </div>
                    </div>
                    
                    <div class="mb-8">
                        <h3 class="text-lg font-semibold mb-3">Order Items</h3>
                        <table class="min-w-full border-collapse border border-gray-300">
                            <thead>
                                <tr class="bg-gray-100">
                                    <th class="border px-4 py-2 text-left">Product</th>
                                    <th class="border px-4 py-2 text-center">Quantity</th>
                                    <th class="border px-4 py-2 text-right">Unit Price</th>
                                    <th class="border px-4 py-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${orderItemsHTML}
                                <tr class="bg-gray-100">
                                    <td colspan="3" class="border px-4 py-2 text-right font-medium">Subtotal:</td>
                                    <td class="border px-4 py-2 text-right">₹${(Number(order.subtotal) || 0).toFixed(2)}</td>
                                </tr>
                                <tr class="bg-gray-100">
                                    <td colspan="3" class="border px-4 py-2 text-right font-medium">Discount:</td>
                                    <td class="border px-4 py-2 text-right">-₹${(Number(order.discountAmount) || 0).toFixed(2)} (${(Number(order.discountPercentage) || 0).toFixed(2)}%)</td>
                                </tr>
                                <tr class="bg-gray-100 font-bold">
                                    <td colspan="3" class="border px-4 py-2 text-right">Total:</td>
                                    <td class="border px-4 py-2 text-right">₹${(Number(order.totalAmount) || 0).toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="no-print mt-8 text-center">
                        <button onclick="window.print()" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                            Print Order
                        </button>
                        <button onclick="window.close()" class="ml-4 bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded">
                            Close
                        </button>
                    </div>
                </div>
            </body>
            </html>
        `;
        
        printWindow.document.write(printContent);
        printWindow.document.close();
        
        // Wait a bit for the content to load, then trigger print
        printWindow.focus();
    };
    
    // Add event listener to orders link to load orders when orders page is viewed
    document.querySelector('.sidebar-link[data-page="orders"]').addEventListener('click', (e) => {
        e.preventDefault();
        // After the page change happens, load the orders
        setTimeout(() => {
            if (!document.getElementById('page-orders').classList.contains('hidden')) {
                renderOrdersTable();
            }
        }, 100);
    });

    // =================================================================
    // --- ANALYTICS SECTION ---
    // =================================================================
    const renderAnalytics = async () => {
        try {
            // Fetch all analytics data in parallel
            const [salesResponse, customerResponse, productResponse] = await Promise.all([
                fetch('/api/analytics/sales?period=monthly', { headers: getAuthHeaders() }),
                fetch('/api/analytics/customers', { headers: getAuthHeaders() }),
                fetch('/api/analytics/products', { headers: getAuthHeaders() })
            ]);
            
            const [salesData, customerData, productData] = await Promise.all([
                salesResponse.json(),
                customerResponse.json(),
                productResponse.json()
            ]);
            
            // Update summary numbers
            document.getElementById('analytics-total-sales').textContent = `₹${salesData.salesData.reduce((sum, item) => sum + (item.totalSales || 0), 0).toFixed(2)}`;
            document.getElementById('analytics-total-orders').textContent = salesData.salesData.reduce((sum, item) => sum + (item.orderCount || 0), 0);
            const avgOrderValue = salesData.salesData.length > 0 
                ? salesData.salesData.reduce((sum, item) => sum + (item.avgOrderValue || 0), 0) / salesData.salesData.length
                : 0;
            document.getElementById('analytics-avg-order').textContent = `₹${avgOrderValue.toFixed(2)}`;
            document.getElementById('analytics-new-customers').textContent = customerData.newCustomersCount;
            
            // Render top products chart
            renderTopProductsChart(productData.topSellingProducts);
            
            // Render sales by category chart
            renderSalesByCategoryChart(productData.productsByCategory);
            
        } catch (error) {
            console.error('Error fetching analytics:', error);
            // Set error messages in the UI
            document.querySelectorAll('#page-analytics [id^="analytics-"]').forEach(el => {
                el.textContent = 'N/A';
            });
        }
    };
    
    // Function to render top products chart
    const renderTopProductsChart = (topProducts) => {
        const ctx = document.getElementById('topProductsChart');
        if (!ctx || !topProducts || topProducts.length === 0) {
            console.error('Top products chart canvas not found or no data');
            return;
        }
        
        // Destroy existing chart if it exists and is a valid Chart instance
        if (window.topProductsChart && typeof window.topProductsChart.destroy === 'function') {
            window.topProductsChart.destroy();
        }
        
        const labels = topProducts.map(p => p.name || p.product || 'Unknown');
        const data = topProducts.map(p => Number(p.totalRevenue || 0));
        
        window.topProductsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Revenue (₹)',
                    data: data,
                    backgroundColor: 'rgba(140, 106, 93, 0.6)',
                    borderColor: 'rgba(140, 106, 93, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Revenue: ₹${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return '₹' + value.toLocaleString();
                            }
                        }
                    }
                }
            }
        });
    };
    
    // Function to render sales by category chart
    const renderSalesByCategoryChart = (categoriesData) => {
        const ctx = document.getElementById('salesByCategoryChart');
        if (!ctx || !categoriesData || categoriesData.length === 0) {
            console.error('Sales by category chart canvas not found or no data');
            return;
        }
        
        // Destroy existing chart if it exists and is a valid Chart instance
        if (window.categoryChart && typeof window.categoryChart.destroy === 'function') {
            window.categoryChart.destroy();
        }
        
        const labels = categoriesData.map(c => c._id || c.category || 'Unknown');
        const data = categoriesData.map(c => Number(c.totalRevenue || 0));
        
        window.categoryChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        'rgba(140, 106, 93, 0.8)',
                        'rgba(115, 86, 75, 0.8)',
                        'rgba(245, 222, 179, 0.8)',
                        'rgba(210, 180, 140, 0.8)',
                        'rgba(188, 143, 143, 0.8)',
                        'rgba(221, 160, 221, 0.8)'
                    ],
                    borderColor: [
                        'rgba(140, 106, 93, 1)',
                        'rgba(115, 86, 75, 1)',
                        'rgba(245, 222, 179, 1)',
                        'rgba(210, 180, 140, 1)',
                        'rgba(188, 143, 143, 1)',
                        'rgba(221, 160, 221, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                return `${label}: ₹${value.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });
    };
    
    // Add event listener to analytics link to load analytics when analytics page is viewed
    document.querySelector('.sidebar-link[data-page="analytics"]').addEventListener('click', (e) => {
        e.preventDefault();
        // After the page change happens, load the analytics
        setTimeout(() => {
            if (!document.getElementById('page-analytics').classList.contains('hidden')) {
                renderAnalytics();
            }
        }, 100);
    });

    // =================================================================
    // --- SETTINGS TAB FUNCTIONALITY ---
    // =================================================================
    const settingsTabs = document.querySelectorAll('#settings-tabs .tab-button');
    const settingsTabContents = document.querySelectorAll('#page-settings .settings-tab-content');
    
    // Add click event listeners to settings tabs
    settingsTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Get the target tab ID from data attribute
            const targetTab = e.target.dataset.tab;
            
            // Remove active class from all tabs and contents
            settingsTabs.forEach(t => t.classList.remove('active'));
            settingsTabContents.forEach(c => c.classList.add('hidden'));
            
            // Add active class to clicked tab
            e.target.classList.add('active');
            
            // Show the corresponding content
            document.getElementById(`tab-${targetTab}`).classList.remove('hidden');
        });
    });
    
    // Set first tab as active by default
    if (settingsTabs.length > 0) {
        settingsTabs[0].classList.add('active');
        settingsTabContents[0].classList.remove('hidden');
    }
    
    // =================================================================
    // --- GENERAL SETTINGS FORM ---
    // =================================================================
    const generalSettingsForm = document.getElementById('tab-general');
    if (generalSettingsForm) {
        const generalForm = generalSettingsForm.querySelector('form');
        if (generalForm) {
            generalForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const storeName = document.getElementById('store-name').value;
                const storeEmail = document.getElementById('store-email').value;
                const storeCurrency = document.getElementById('store-currency').value;
                
                try {
                    // In a real implementation, you would save these settings to the backend
                    // For now, we'll just show a success message
                    alert('General settings saved successfully!');
                    
                    // You would typically make an API call like:
                    /*
                    const response = await fetch('/api/settings/general', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAuthHeaders()
                        },
                        body: JSON.stringify({
                            storeName,
                            storeEmail,
                            storeCurrency
                        })
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to save settings');
                    }
                    
                    alert('General settings saved successfully!');
                    */
                } catch (error) {
                    console.error('Error saving general settings:', error);
                    alert('Error saving settings: ' + error.message);
                }
            });
        }
    }
    
    // =================================================================
    // --- ACCOUNT SETTINGS FORM ---
    // =================================================================
    const accountSettingsForm = document.getElementById('tab-account');
    if (accountSettingsForm) {
        const accountForm = accountSettingsForm.querySelector('form');
        if (accountForm) {
            accountForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const adminName = document.getElementById('admin-name').value;
                const adminEmail = document.getElementById('admin-email').value;
                
                try {
                    // Update admin profile info using existing API
                    const response = await fetch('/api/auth/admin/profile', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            ...getAuthHeaders()
                        },
                        body: JSON.stringify({
                            fullName: adminName,
                            email: adminEmail
                        })
                    });
                    
                    const result = await response.json();
                    
                    if (!response.ok) {
                        throw new Error(result.message || 'Failed to update profile');
                    }
                    
                    alert('Account settings updated successfully!');
                    
                    // Update the profile link in the header with the new name
                    const profileNameElement = document.querySelector('#user-menu-btn .text-text-primary');
                    if (profileNameElement) {
                        profileNameElement.textContent = adminName;
                    }
                } catch (error) {
                    console.error('Error updating account settings:', error);
                    alert('Error updating account settings: ' + error.message);
                }
            });
        }
    }
    
    // =================================================================
    // --- PAYMENT SETTINGS FORM ---
    // =================================================================
    const paymentSettingsForm = document.getElementById('tab-payment');
    if (paymentSettingsForm) {
        // Handle connect new gateway button
        const connectGatewayBtn = paymentSettingsForm.querySelector('.login-btn');
        if (connectGatewayBtn) {
            connectGatewayBtn.addEventListener('click', (e) => {
                e.preventDefault();
                alert('Payment gateway connection would be handled in a real implementation');
                
                // In a real implementation, you would redirect to payment provider's OAuth flow
                // or open a modal to enter API keys
            });
        }
    }
    
    // =================================================================
    // --- SHIPPING SETTINGS FORM ---
    // =================================================================
    const shippingSettingsForm = document.getElementById('tab-shipping');
    if (shippingSettingsForm) {
        // Handle add shipping zone button
        const addShippingZoneBtn = shippingSettingsForm.querySelector('.login-btn');
        if (addShippingZoneBtn) {
            addShippingZoneBtn.addEventListener('click', (e) => {
                e.preventDefault();
                alert('Add shipping zone functionality would be implemented in a real application');
                
                // In a real implementation, you would open a modal to configure shipping zones
            });
        }
    }

    // =================================================================
    // --- INITIAL RENDER ---
    // =================================================================
    fetchProductsAndRender();
    renderCustomersTable();
    
    // Load orders if the orders page is active on initial load
    if (!document.getElementById('page-orders').classList.contains('hidden')) {
        renderOrdersTable();
    }
    
    // Load analytics if the analytics page is active on initial load
    if (!document.getElementById('page-analytics').classList.contains('hidden')) {
        renderAnalytics();
    }
    
    // Load dashboard metrics if dashboard is the active page on initial load
    if (!document.getElementById('page-dashboard').classList.contains('hidden')) {
        renderDashboardMetrics();
    }

    // =================================================================
    // --- INITIALIZE ALL MODAL CLOSE HANDLERS ---
    // =================================================================
    // Setup close handlers for all modals using the generic helper
    // This ensures consistent modal behavior and prevents click event issues
    setupModalCloseHandler('product-modal', 'close-product-modal-btn');
    setupModalCloseHandler('profile-modal', 'close-profile-modal-btn');
    setupModalCloseHandler('discount-modal', 'close-discount-modal-btn');
    setupModalCloseHandler('order-modal', 'close-order-modal-btn');
    
    console.log('All modal close handlers initialized');
});
