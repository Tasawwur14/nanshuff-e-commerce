
        document.addEventListener('DOMContentLoaded', () => {
            const cartItemsContainer = document.getElementById('cart-items-container');
            const emptyCartMessage = document.getElementById('empty-cart-message');

            // If SPA Router is handling this page, skip the initialization to prevent conflicts
            if (typeof SPARouter !== 'undefined' && SPARouter.isInitialized) {
                // Router will handle cart initialization
                return;
            }

            // Fallback: Load cart if not handled by router
            async function loadCartItems() {
                try {
                    const response = await fetch('/api/cart', {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (!response.ok) {
                        throw new Error('Failed to load cart');
                    }
                    
                    const cartData = await response.json();
                    displayCartItems(cartData.items || []);
                    updateSummary(cartData.items || [], cartData.discountPercentage || 0);
                } catch (error) {
                    console.error('Error loading cart items:', error);
                    cartItemsContainer.innerHTML = '';
                    emptyCartMessage.classList.remove('hidden');
                }
            }

            function displayCartItems(items) {
                cartItemsContainer.innerHTML = '';
                
                if (items.length === 0) {
                    emptyCartMessage.classList.remove('hidden');
                    document.getElementById('cart-content').classList.add('hidden');
                    return;
                }
                
                emptyCartMessage.classList.add('hidden');
                document.getElementById('cart-content').classList.remove('hidden');
                
                items.forEach(item => {
                    const cartItem = document.createElement('div');
                    cartItem.className = 'cart-item-container flex items-center bg-white p-4 rounded-lg shadow-sm';
                    cartItem.innerHTML = `
                        <img src="${item.imageUrl || 'https://placehold.co/100x100/e0dacf/8C6A5D?text=Product'}" 
                             alt="${item.name || 'Product'}" 
                             class="w-24 h-24 object-cover rounded-md">
                        <div class="flex-grow ml-4">
                            <h3 class="font-semibold text-text-primary">${item.name || 'Product'}</h3>
                            <p class="text-sm text-text-secondary">Product ID: ${item.product || item.productId}</p>
                            <div class="flex flex-wrap items-center gap-2 mt-1">
                                <p class="text-lg font-bold text-accent-brown" data-price="${item.price}">₹${Number(item.price).toFixed(2)}</p>
                                ${item.mrp && item.mrp > 0 && item.discount > 0 && item.mrp !== item.price ? `<p class="text-sm text-gray-500 line-through">₹${Number(item.mrp).toFixed(2)}</p>` : ''}
                                ${item.discount > 0 ? `<p class="text-sm font-semibold text-green-600 bg-green-100 px-2 py-1 rounded">(${item.discount}% off)</p>` : ''}
                            </div>
                        </div>
                        <div class="flex items-center space-x-3">
                            <button class="quantity-btn px-2 py-1 border rounded-md" data-action="decrease">-</button>
                            <span class="quantity">${item.quantity}</span>
                            <button class="quantity-btn px-2 py-1 border rounded-md" data-action="increase">+</button>
                        </div>
                        <div class="ml-4 text-right">
                            <p class="font-semibold">₹${(Number(item.price) * item.quantity).toFixed(2)}</p>
                            <button class="remove-item-btn text-xs text-red-500 hover:underline mt-1">Remove</button>
                        </div>
                    `;
                    cartItemsContainer.appendChild(cartItem);
                });
            }

            function updateSummary(items = null, discountPercentage = 0) {
                // If items is null, we're just updating discount, so we need to get current subtotal
                let subtotal = 0;
                const summarySubtotalElement = document.getElementById('summary-subtotal');
                const summaryTotalElement = document.getElementById('summary-total');
                
                if (items) {
                    // Full items array provided, recalculate subtotal
                    items.forEach(item => {
                        if (item && item.price && item.quantity) {
                            subtotal += parseFloat(item.price) * parseInt(item.quantity);
                        }
                    });
                    
                    // Update subtotal display if element exists
                    if (summarySubtotalElement) {
                        summarySubtotalElement.textContent = `₹${subtotal.toFixed(2)}`;
                    }
                } else {
                    // No items provided, get current subtotal from DOM
                    if (summarySubtotalElement) {
                        const currentSubtotalText = summarySubtotalElement.textContent.replace('₹', '').trim();
                        subtotal = parseFloat(currentSubtotalText) || 0;
                    }
                }
                
                // Calculate discount and total
                const discountAmount = subtotal * (discountPercentage / 100);
                const total = subtotal - discountAmount;
                
                // Update total display if element exists
                if (summaryTotalElement) {
                    summaryTotalElement.textContent = `₹${total.toFixed(2)}`;
                }
            }

            // Handle quantity button clicks
            async function handleQuantityButtonClick(event) {
                const button = event.target.closest('.quantity-btn');
                if (!button) return;

                const cartItem = button.closest('.cart-item-container');
                if (!cartItem) return;

                const productIdElement = cartItem.querySelector('p.text-sm');
                if (!productIdElement) return;

                // Extract product ID from "Product ID: xxx" text
                const productIdMatch = productIdElement.textContent.match(/Product ID: (\d+)/);
                if (!productIdMatch) return;

                const productId = productIdMatch[1];
                const quantityElement = cartItem.querySelector('.quantity');
                const currentQuantity = parseInt(quantityElement.textContent);
                
                if (isNaN(currentQuantity)) return;

                let newQuantity;
                if (button.dataset.action === 'increase') {
                    newQuantity = currentQuantity + 1;
                } else if (button.dataset.action === 'decrease') {
                    // If quantity is already 1, don't decrease further (do nothing)
                    if (currentQuantity <= 1) {
                        return;
                    }
                    newQuantity = currentQuantity - 1;
                } else {
                    return; // Unknown action
                }

                // Update cart via API
                try {
                    const response = await fetch('/api/cart', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ productId, quantity: newQuantity })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to update cart');
                    }

                    // Reload cart to reflect changes
                    await loadCartItems();
                } catch (error) {
                    console.error('Error updating cart item:', error);
                    alert('Failed to update cart item. Please try again.');
                }
            }

            // Handle remove button clicks
            async function handleRemoveItemClick(event) {
                const button = event.target.closest('.remove-item-btn');
                if (!button) return;

                const cartItem = button.closest('.cart-item-container');
                if (!cartItem) return;

                const productIdElement = cartItem.querySelector('p.text-sm');
                if (!productIdElement) return;

                // Extract product ID from "Product ID: xxx" text
                const productIdMatch = productIdElement.textContent.match(/Product ID: (\d+)/);
                if (!productIdMatch) return;

                const productId = productIdMatch[1];

                // Remove item from cart via API
                // For guest users, we use POST with quantity 0 instead of DELETE
                try {
                    const response = await fetch('/api/cart', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ productId, quantity: 0 })
                    });

                    if (!response.ok) {
                        throw new Error('Failed to remove item from cart');
                    }

                    // Reload cart to reflect changes
                    await loadCartItems();
                } catch (error) {
                    console.error('Error removing item from cart:', error);
                    alert('Failed to remove item from cart. Please try again.');
                }
            }

            // Add event listeners for cart operations
            cartItemsContainer.addEventListener('click', (event) => {
                if (event.target.closest('.quantity-btn')) {
                    handleQuantityButtonClick(event);
                } else if (event.target.closest('.remove-item-btn')) {
                    handleRemoveItemClick(event);
                }
            });

            // Add discount code functionality
            const discountInput = document.getElementById('discount-code');
            const applyDiscountBtn = document.getElementById('apply-discount-btn');
            const discountMessage = document.getElementById('discount-message');
            
            if (applyDiscountBtn && discountInput && discountMessage) {
                applyDiscountBtn.addEventListener('click', async () => {
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
                            
                            // Update the summary with the discount
                            updateSummary(null, result.discountPercentage);
                            discountMessage.textContent = `${code} applied! You get ${result.discountPercentage}% off.`;
                            discountMessage.className = 'text-xs mt-2 h-4 text-green-600';
                        } else {
                            // Clear any previously applied discount
                            await fetch('/api/cart/discount', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ code: null, discountPercentage: 0 })
                            });
                            
                            updateSummary(null, 0);
                            discountMessage.textContent = result.message || 'Invalid discount code.';
                            discountMessage.className = 'text-xs mt-2 h-4 text-red-500';
                        }
                    } catch (error) {
                        console.error('Error validating discount code:', error);
                        // Clear any previously applied discount
                        await fetch('/api/cart/discount', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ code: null, discountPercentage: 0 })
                        });
                        
                        updateSummary(null, 0);
                        discountMessage.textContent = 'Error validating discount code.';
                        discountMessage.className = 'text-xs mt-2 h-4 text-red-500';
                    }
                });
            }

            // Add event listener for the proceed to checkout button
            const proceedCheckoutBtn = document.getElementById('proceed-checkout-btn');
            if (proceedCheckoutBtn) {
                proceedCheckoutBtn.addEventListener('click', () => {
                    window.location.href = '/checkout';
                });
            }

            // Add event listener for the "Add to Cart" buttons in the "You might also like" section
            document.addEventListener('click', async function(event) {
                if (event.target.classList.contains('add-to-cart-btn') || 
                    event.target.closest('.add-to-cart-btn')) {
                    
                    const button = event.target.classList.contains('add-to-cart-btn') ? 
                        event.target : event.target.closest('.add-to-cart-btn');
                    const productId = button.dataset.id;
                    
                    if (!productId) {
                        console.error('No product ID found for add to cart button');
                        return;
                    }
                    
                    // Prevent the default link navigation if the button is within an anchor tag
                    event.preventDefault();
                    
                    if (button.disabled) return; // Prevent multiple clicks while processing

                    const originalText = button.innerHTML;
                    button.innerHTML = 'Adding...';
                    button.disabled = true;

                    try {
                        // Get current cart to check if product is already in cart
                        const cartResponse = await fetch('/api/cart', { credentials: 'include' });
                        if (!cartResponse.ok) {
                            throw new Error(`Failed to fetch cart: ${cartResponse.status}`);
                        }
                        
                        const cart = await cartResponse.json();
                        if (!cart.items || !Array.isArray(cart.items)) {
                            console.error('Invalid cart format received:', cart);
                            throw new Error('Invalid cart format');
                        }

                        // Check if the product already exists in the cart
                        const existingItem = cart.items.find(item => {
                            // Handle both populated cart (with object) and session cart (with string id)
                            return String(item.productId || item.product) === String(productId);
                        });

                        // Determine quantity to set
                        let newQty = 1;
                        if (existingItem) {
                            // If item already exists, increment quantity
                            newQty = (existingItem.quantity || 1) + 1;
                        }

                        // Add to cart with the calculated quantity
                        await updateCartItem(productId, newQty, () => {
                            // Update cart counter
                            updateCartCounter();
                        });
                        
                        button.innerHTML = 'Added!';
                        
                        // Reset button after 2 seconds
                        setTimeout(() => {
                            button.innerHTML = originalText;
                            button.disabled = false;
                        }, 2000);
                        
                    } catch (error) {
                        console.error("Add to cart error:", error);
                        button.innerHTML = 'Error';
                        setTimeout(() => {
                            button.innerHTML = originalText;
                            button.disabled = false;
                        }, 2000);
                    }
                }
            });

            // Function to update cart item quantity
            async function updateCartItem(productId, qty, callback) {
                try {
                    let response;
                    if (qty === 0) {
                        // Use DELETE endpoint to remove item from cart
                        response = await fetch(`/api/cart/${productId}`, {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' }
                        });
                    } else {
                        // Use POST endpoint to add/update item in cart
                        response = await fetch('/api/cart', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ productId, quantity: qty })
                        });
                    }

                    if (!response.ok) {
                        const errorData = await response.json();
                        console.error('Cart update failed:', errorData);
                        throw new Error('Failed to update cart: ' + (errorData.message || response.statusText));
                    }

                    // Call the callback to refresh cart display
                    if (callback) callback();
                } catch (error) {
                    console.error('Cart update error:', error);
                    throw error;
                }
            }

            // Function to update cart counter
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

            // Carousel functionality for "You Might Also Like" section
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

            // Load cart items when page loads (only if not using SPA router)
            loadCartItems();
        });