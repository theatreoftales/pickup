const IS_STORE_OPEN = true;
  let productsData = [], cart = [], currentActiveImgUrl = "", currentSelectedProdIdx = null, toastTimeout = null;
  let currentTempOrder = { customerInfo: null, cartItems: null, orderId: '', totalAmount: 0, paymentMethod: '' };
  let currentLang = 'vi';
  let selectedOptionIndex = null;

  const TOAST_MSGS = {
    closed: { vi: "Hàng trưng bày chưa bán", en: "Display items only" },
    limitStock: (n) => ({ vi: `Chỉ còn ${n} sản phẩm thui nha!`, en: `Only ${n} left in stock!` }),
    added: (n) => ({ vi: `Đã thêm ${n} sản phẩm vào giỏ!`, en: `Added ${n} item(s) to cart!` }),
    selectQty: { vi: "Hãy chọn ít nhất một sản phẩm nha!", en: "Please select quantity!" },
    fillInfo: { vi: "Hãy điền đủ thông tin giúp tụi mình nha!", en: "Please fill in all required fields!" },
    errEmail: { vi: "Vui lòng nhập Email!", en: "Please enter your Email!" },
    errInvalidEmail: { vi: "Email không đúng định dạng!", en: "Invalid email address!" },
    errFb: { vi: "Vui lòng nhập Link Facebook!", en: "Please enter your Facebook link!" },
    errName: { vi: "Vui lòng nhập Tên pick up!", en: "Please enter your pickup name!" },
    errDate: { vi: "Vui lòng chọn Ngày pick up!", en: "Please select a pickup date!" },
    errTicket: { vi: "Lỗi khi lưu vé, bạn thử lại xem!", en: "An error occurred while saving your ticket. Please try again!" }
  };

  const API_BASE_URL = "https://script.google.com/macros/s/AKfycbw9juAgK6aqpaprJmOgO8klyYJyEHY8iyBpUssQuj0xWJfe7OGOyZumZsY1k1bY2gmCFQ/exec";

  const GET_ACTIONS = new Set(['getProducts', 'getEvents', 'getAllCustomerMap']);
  function runGoogleScript(funcName, ...args) {
    const url = `${API_BASE_URL}?action=${encodeURIComponent(funcName)}`;

    let fetchPromise;
    if (GET_ACTIONS.has(funcName)) {
      fetchPromise = fetch(url);
    } else {
      let payload = {};
      if (funcName === 'createOrderTemp') {
        payload = { customerInfo: args[0], cartItems: args[1] };
      } else if (funcName === 'confirmAndSaveOrder') {
        payload = { customerInfo: args[0], cartItems: args[1], orderId: args[2], totalAmount: args[3], paymentMethod: args[4] };
      } else if (funcName === 'getCustomerInfoByEmail') {
        payload = { email: args[0] };
      }

      fetchPromise = fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
    }

    return fetchPromise
      .then(res => res.json())
      .then(json => {
        if (!json || json.ok !== true) {
          throw new Error((json && json.error) || 'Lỗi không xác định từ máy chủ');
        }
        return json.data;
      });
  }

  document.addEventListener('DOMContentLoaded', async function() {
    try {
      const products = await runGoogleScript('getProducts');
      productsData = products || [];
      renderProducts(productsData);
    } catch (err) {
      console.error("Lỗi khởi tạo dữ liệu:", err);
    }
  });

    document.addEventListener('contextmenu', function (e) {
      e.preventDefault();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'F12' || (e.ctrlKey && (e.key === 'u' || e.key === 's' || e.key === 'I' || e.key === 'i'))) {
        e.preventDefault();
        
        // Chọn câu thông báo dựa theo ngôn ngữ hiện tại
        const message = (currentLang === 'en') 
          ? "No F12 for you, ner nner na na!" 
          : "Không cho F12 đấy lêu lêu!";
          
        showToast(message);
      }
    });

  function renderProducts(products) {
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';

    const contentArea = document.getElementById('catalogContentArea');
    if (contentArea) contentArea.style.display = 'block';

    const allProducts = products || [];
    const container = document.getElementById('productList');
    const newContainer = document.getElementById('newProductList');
    const newSection = document.getElementById('newArrivalsSection');
    const bannerContainer = document.getElementById('storeClosedBannerContainer');
    const divider = document.querySelector('.product-divider');
    const defaultImg = "https://i.ibb.co/39kx44LC/Theatre-of-Tales-600.png";

    let bannerHtml = !IS_STORE_OPEN ? `<div class="store-closed-banner" style="width: 100%; margin-bottom: 20px;">${currentLang === 'en' ? '（*＾-＾*）We are currently closed. Please check back later!' : '（*＾-＾*）Tụi mình đang tạm nghỉ rồi. Bạn hãy quay lại sau nha!'}</div>` : '';
    
    if (bannerContainer) {
      bannerContainer.innerHTML = bannerHtml;
    }

    if (!allProducts || allProducts.length === 0) {
      if (newSection) newSection.style.display = 'none';
      if (divider) divider.style.display = 'none';
      if (container) container.innerHTML = (currentLang === 'en' ? "No products available." : "Chưa có sản phẩm nào.");
      return;
    }

    const searchInput = document.getElementById('searchProductInput');
    const keyword = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const isSearching = keyword !== "";

    const matchKeyword = (p) => {
      if (!keyword) return true;
      const nameVi = (p.name || "").toLowerCase();
      const nameEn = (p.nameEn || "").toLowerCase();
      const matchName = nameVi.includes(keyword) || nameEn.includes(keyword);
      const matchOption = p.options && p.options.some(opt => (opt.optionName || "").toLowerCase().includes(keyword));
      return matchName || matchOption;
    };

    let activeNewProducts = allProducts.filter(p => p.isNew && matchKeyword(p));

    if (activeNewProducts.length > 0 && newSection && newContainer) {
      newSection.style.display = 'block';
      newContainer.innerHTML = activeNewProducts.map((p) => {
        const idx = productsData.findIndex(item => item.name === p.name);
        const prodName = currentLang === 'en' ? (p.nameEn || p.name) : p.name;
        const priceText = currentLang === 'en' ? `From ${Number(p.price).toLocaleString()}đ` : `Từ ${Number(p.price).toLocaleString()}đ`;
        const rawImg = (p.images && p.images.length > 0) ? p.images[0] : null;
        const prodImg = (rawImg && typeof rawImg === 'string' && rawImg.trim() !== "") ? rawImg : defaultImg;

        return `
          <div class="product-card" onclick="openProductDetail(${idx})">
            <div><img src="${prodImg}"><h4>${prodName}</h4></div>
            <div><span class="price-pill">${priceText}</span></div>
          </div>`;
      }).join('');
    } else if (newSection) {
      newSection.style.display = 'none';
    }

    let displayList = isSearching 
      ? allProducts.filter(p => !p.isNew && matchKeyword(p))
      : allProducts.filter(p => !p.isNew);

    if (container) {
      if (displayList.length === 0 && activeNewProducts.length === 0 && isSearching) {
        container.innerHTML = (currentLang === 'en' ? "No products found." : "Không tìm thấy sản phẩm nào phù hợp.");
      } else if (displayList.length === 0 && isSearching && activeNewProducts.length > 0) {
        container.innerHTML = "";
      } else {
        container.innerHTML = displayList.map((p) => {
          const idx = productsData.findIndex(item => item.name === p.name);
          const prodName = currentLang === 'en' ? (p.nameEn || p.name) : p.name;
          const priceText = currentLang === 'en' ? `From ${Number(p.price).toLocaleString()}đ` : `Từ ${Number(p.price).toLocaleString()}đ`;
          const rawImg = (p.images && p.images.length > 0) ? p.images[0] : null;
          const prodImg = (rawImg && typeof rawImg === 'string' && rawImg.trim() !== "") ? rawImg : defaultImg;

          return `
            <div class="product-card" onclick="openProductDetail(${idx})">
              <div><img src="${prodImg}"><h4>${prodName}</h4></div>
              <div><span class="price-pill">${priceText}</span></div>
            </div>`;
        }).join('');
      }
    }

    if (divider) {
      if (activeNewProducts.length > 0 && displayList.length > 0) {
        divider.style.display = 'block'; 
      } else {
        divider.style.display = 'none';
      }
    }
  }

  function openProductDetail(prodIdx) {
    currentSelectedProdIdx = prodIdx;
    selectedOptionIndex = null;
    const prod = productsData[prodIdx];
    currentActiveImgUrl = prod.images && prod.images[0] ? prod.images[0] : '';
    
    const mainImg = document.getElementById('detailMainImg');
    if (mainImg) mainImg.src = currentActiveImgUrl;

    const thumbContainer = document.getElementById('thumbnailList');
    if (thumbContainer) {
      if (prod.images && prod.images.length > 1) {
        thumbContainer.innerHTML = prod.images.map((imgUrl, i) => 
          `<img src="${imgUrl}" class="thumb-img ${i===0?'active':''}" onclick="switchMainImg('${imgUrl}', this)">`
        ).join('');
        thumbContainer.style.display = 'flex';
      } else { 
        thumbContainer.style.display = 'none'; 
      }
    }

    const titleElem = document.getElementById('detailTitle');
    if (titleElem) {
      titleElem.innerText = currentLang === 'en' ? (prod.nameEn || prod.name) : prod.name;
    }

    const descElem = document.getElementById('detailDescription');
    if (descElem) {
      const descriptionText = currentLang === 'en' ? (prod.descEn || prod.description || '') : (prod.description || '');
      descElem.innerText = descriptionText;
      descElem.style.display = descriptionText ? 'block' : 'none';
    }
  
    const optListContainer = document.getElementById('detailOptionList');
    let optionsToRender = (prod.options && prod.options.length > 0) ? prod.options : [{ optionName: "Mặc định", price: prod.price, stock: prod.stock }];
    
    selectedOptionIndex = 0;
    const firstOpt = optionsToRender[0];
    const firstPrice = firstOpt.price !== undefined ? Number(firstOpt.price) : Number(prod.price);
    
    const priceElem = document.getElementById('detailPrice');
    if (priceElem) {
      priceElem.innerText = firstPrice.toLocaleString() + 'đ';
    }

    const firstOptStock = firstOpt.stock !== undefined ? parseInt(firstOpt.stock) : 0;
    const isFirstOut = firstOptStock <= 0;

    let optionsHtml = `<div class="options-grid-wrapper">`;
    optionsHtml += optionsToRender.map((opt, oIdx) => {
      const maxStock = opt.stock !== undefined ? parseInt(opt.stock) : 0;
      const isOut = maxStock <= 0;
      
      return `
        <div class="option-item-new ${oIdx === 0 ? 'selected' : ''} ${isOut ? 'option-sold-out' : ''}" id="optCard_${oIdx}" onclick="selectProductOption(${oIdx})" ${isOut ? 'style="opacity: 0.4; filter: grayscale(100%);"' : ''}>
          <div class="option-info">
            <div>${opt.optionName}</div>
          </div>
        </div>`;
    }).join('');
    optionsHtml += `</div>`;

    let actionRowHtml = `
      <div class="action-row-container">
        <div class="global-qty-box">
          <div class="qty-control" style="margin: 0;">
    `;

    if (isFirstOut) {
      const outQtyText = currentLang === 'en' ? 'Ah?' : 'Hả?';
      const outBtnText = currentLang === 'en' ? 'Sold out for real!' : 'Hết hàng thật rồi mà!';
      actionRowHtml += `
            <button class="qty-btn" disabled>-</button>
            <input type="text" id="globalQtyInput" class="qty-input" value="${outQtyText}" readonly style="background: #ffffff !important; color: #666 !important;">
            <button class="qty-btn" disabled>+</button>
          </div>
        </div>
        <button class="btn btn-disabled btn-add-cart-custom" disabled style="background-color: #ccc !important; color: #666 !important;">${outBtnText}</button>
      `;
    } else {
      actionRowHtml += `
            <button class="qty-btn" onclick="changeGlobalQty(-1)">-</button>
            <input type="number" id="globalQtyInput" class="qty-input" value="1" min="0" style="background: #ffffff !important;">
            <button class="qty-btn" onclick="changeGlobalQty(1)">+</button>
          </div>
        </div>
      `;
      actionRowHtml += IS_STORE_OPEN 
        ? `<button class="btn btn-success btn-add-cart-custom" onclick="addSelectedOptionToCart(${prodIdx})">${currentLang === 'en' ? 'Add to Cart' : 'Thêm vào giỏ hàng'}</button>`
        : `<button class="btn btn-disabled btn-add-cart-custom" disabled>${currentLang === 'en' ? 'Display only.' : 'Hàng trưng bày chưa bán.'}</button>`;
    }
    
    actionRowHtml += `</div>`;

    if (optListContainer) {
      optListContainer.innerHTML = optionsHtml + actionRowHtml;
    }

    const catalogView = document.getElementById('catalogView');
    if (catalogView) catalogView.style.display = 'none';

    const detailView = document.getElementById('detailView');
    if (detailView) detailView.style.display = 'block';
    
    if (typeof applyLanguageToDOM === 'function') {
      applyLanguageToDOM();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function selectProductOption(oIdx) {
    const prod = productsData[currentSelectedProdIdx];
    let optionsToRender = (prod.options && prod.options.length > 0) ? prod.options : [{ optionName: "Mặc định", price: prod.price, stock: prod.stock }];
    let opt = optionsToRender[oIdx];
    const maxStock = opt.stock !== undefined ? parseInt(opt.stock) : 0;
    const isOut = maxStock <= 0;

    document.querySelectorAll('.option-item-new').forEach((el, idx) => {
      el.classList.remove('selected');
      if (idx === oIdx) el.classList.add('selected');
    });

    selectedOptionIndex = oIdx;

    const currentPrice = opt.price !== undefined ? Number(opt.price) : Number(prod.price);
    const priceElem = document.getElementById('detailPrice');
    if (priceElem) {
      priceElem.innerText = currentPrice.toLocaleString() + 'đ';
    }

    const actionContainer = document.querySelector('.action-row-container');
    if (actionContainer) {
      let actionRowHtml = `
        <div class="global-qty-box">
          <div class="qty-control" style="margin: 0;">
      `;

      if (isOut) {
        const outQtyText = currentLang === 'en' ? 'Ah?' : 'Hả?';
        const outBtnText = currentLang === 'en' ? 'Sold out for real!' : 'Hết hàng thật rồi mà!';
        actionRowHtml += `
              <button class="qty-btn" disabled>-</button>
              <input type="text" id="globalQtyInput" class="qty-input" value="${outQtyText}" readonly style="background: #ffffff !important; color: #666 !important;">
              <button class="qty-btn" disabled>+</button>
            </div>
          </div>
          <button class="btn btn-disabled btn-add-cart-custom" disabled style="background-color: #ccc !important; color: #666 !important;">${outBtnText}</button>
        `;
      } else {
        actionRowHtml += `
              <button class="qty-btn" onclick="changeGlobalQty(-1)">-</button>
              <input type="number" id="globalQtyInput" class="qty-input" value="1" min="0" style="background: #ffffff !important;">
              <button class="qty-btn" onclick="changeGlobalQty(1)">+</button>
            </div>
          </div>
        `;
        actionRowHtml += IS_STORE_OPEN 
          ? `<button class="btn btn-success btn-add-cart-custom" onclick="addSelectedOptionToCart(${currentSelectedProdIdx})">${currentLang === 'en' ? 'Add to Cart' : 'Thêm vào giỏ hàng'}</button>`
          : `<button class="btn btn-disabled btn-add-cart-custom" disabled>${currentLang === 'en' ? 'Display only.' : 'Hàng trưng bày chưa bán.'}</button>`;
      }
      actionContainer.innerHTML = actionRowHtml;
    }
  }

  function changeGlobalQty(delta) {
    if (!IS_STORE_OPEN) return showToast(TOAST_MSGS.closed[currentLang]);
    const input = document.getElementById('globalQtyInput');
    if (!input) return;
    let val = parseInt(input.value) || 0;
    let newVal = Math.max(0, val + delta);

    if (selectedOptionIndex !== null) {
      const prod = productsData[currentSelectedProdIdx];
      let optionsToRender = (prod.options && prod.options.length > 0) ? prod.options : [{ optionName: "Mặc định", price: prod.price, stock: prod.stock }];
      let opt = optionsToRender[selectedOptionIndex];
      const maxStock = opt.stock !== undefined ? parseInt(opt.stock) : 0;
      
      if (newVal > maxStock) {
        showToast(TOAST_MSGS.limitStock(maxStock)[currentLang]);
        return;
      }
    }
    input.value = newVal;
  }

  function addSelectedOptionToCart(prodIdx) {
    if (!IS_STORE_OPEN) return showToast(TOAST_MSGS.closed[currentLang]);
    if (selectedOptionIndex === null) return showToast(currentLang === 'en' ? 'Please select an option!' : 'Hãy chọn ít nhất 1 sản phẩm nha!');

    const input = document.getElementById('globalQtyInput');
    const qty = input ? parseInt(input.value) || 0 : 0;

    if (qty <= 0) {
      return showToast(TOAST_MSGS.selectQty[currentLang]);
    }

    const prod = productsData[prodIdx];
    let optionsToRender = (prod.options && prod.options.length > 0) ? prod.options : [{ optionName: "Mặc định", price: prod.price, stock: prod.stock }];
    let opt = optionsToRender[selectedOptionIndex];
    const maxStock = opt.stock !== undefined ? parseInt(opt.stock) : 0;

    if (maxStock <= 0) return showToast(currentLang === 'en' ? 'Out of stock my dear!' : 'Hết hàng rùi bạn ơi!');

    const currentPrice = opt.price !== undefined ? Number(opt.price) : Number(prod.price);
    const cartKey = `${prod.name}_${opt.optionName}`;
    const existing = cart.find(i => i.key === cartKey);
    const currentCartQty = existing ? existing.quantity : 0;

    if (currentCartQty + qty > maxStock) {
      return showToast(TOAST_MSGS.limitStock(maxStock)[currentLang]);
    }

    if (existing) {
      existing.quantity += qty;
    } else {
      cart.push({ 
        key: cartKey, 
        name: prod.name, 
        nameEn: prod.nameEn, 
        option: opt.optionName, 
        price: currentPrice, 
        quantity: qty, 
        stock: maxStock 
      });
    }

    updateCartBadge(); 
    showToast(TOAST_MSGS.added(qty)[currentLang]);
    if (input) input.value = 0;
  }


  function switchMainImg(url, el) {
    currentActiveImgUrl = url;
    document.getElementById('detailMainImg').src = url;
    document.querySelectorAll('.thumb-img').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
  }

  function showCatalogView() {
    document.getElementById('detailView').style.display = 'none';
    const fesView = document.getElementById('fesCalendarView');
    if (fesView) fesView.style.display = 'none';
    document.getElementById('catalogView').style.display = 'block';
    currentSelectedProdIdx = null;
  }

  // ===== LỊCH FES THAM GIA =====
  let fesEventsData = [];

  async function openFesCalendar() {
  document.getElementById('catalogView').style.display = 'none';
  document.getElementById('detailView').style.display = 'none';
  document.getElementById('fesCalendarView').style.display = 'block';
  document.getElementById('fesTimelineContainer').innerHTML =
    `<div style="text-align:center;padding:40px;color:#666;">${currentLang === 'en' ? 'Loading fes schedule...' : 'Đang tải lịch fes...'}</div>`;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  try {
    const events = await runGoogleScript('getEvents');
    renderFesTimeline(events);
  } catch (err) {
    document.getElementById('fesTimelineContainer').innerHTML =
      `<div style="text-align:center;padding:40px;color:#d32f2f;">${currentLang === 'en' ? 'Error loading data: ' : 'Lỗi tải dữ liệu: '}${err.message}</div>`;
  }
}

  function parseFesDate(str) {
    // Kỳ vọng backend trả dd/MM/yyyy. Trả về {dd, mm, yyyy} hoặc null nếu không hợp lệ.
    if (!str) return null;
    const parts = String(str).trim().split('/');
    if (parts.length !== 3) return null;
    return { dd: parts[0], mm: parts[1], yyyy: parts[2] };
  }

  function buildFesDateBlock(ev) {
    const start = parseFesDate(ev.startDate);
    const end = parseFesDate(ev.endDate);

    let dateText = currentLang === 'en' ? "Updating" : "Đang cập nhật";
    let yearText = "";

    if (start && end) {
      const sameDay = (start.dd === end.dd && start.mm === end.mm && start.yyyy === end.yyyy);
      dateText = sameDay ? `${start.dd}/${start.mm}` : `${start.dd}/${start.mm} - ${end.dd}/${end.mm}`;
      yearText = (start.yyyy === end.yyyy) ? start.yyyy : `${start.yyyy} - ${end.yyyy}`;
    } else if (start) {
      dateText = `${start.dd}/${start.mm}`;
      yearText = start.yyyy;
    } else if (end) {
      dateText = `${end.dd}/${end.mm}`;
      yearText = end.yyyy;
    }

    const yearHtml = yearText ? `<div class="fes-date-year">${yearText}</div>` : "";
    return `<div class="fes-date-text">${dateText}</div>${yearHtml}`;
  }

  function renderFesTimeline(events) {
    fesEventsData = events || [];
    const container = document.getElementById('fesTimelineContainer');
    if (!container) return;

    if (fesEventsData.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:40px;color:#666;">Hiện chưa có lịch fes nào được cập nhật.</div>`;
      return;
    }

    const statusMap = {
      "sắp diễn ra": "status-upcoming",
      "đang diễn ra": "status-ongoing",
      "đã kết thúc": "status-ended"
    };

    const statusLabelMap = {
      "sắp diễn ra": { vi: "Sắp diễn ra", en: "Upcoming" },
      "đang diễn ra": { vi: "Đang diễn ra", en: "Ongoing" },
      "đã kết thúc": { vi: "Đã kết thúc", en: "Ended" }
    };

    const itemsHtml = fesEventsData.map(function(ev) {
      const statusKey = (ev.status || "").toLowerCase().trim();
      const statusClass = statusMap[statusKey] || "status-upcoming";
      const statusLabelObj = statusLabelMap[statusKey];
      const statusLabel = statusLabelObj ? statusLabelObj[currentLang] : (ev.status || (currentLang === 'en' ? "Upcoming" : "Sắp diễn ra"));

      const dateBlockHtml = buildFesDateBlock(ev);
      const imgHtml = ev.image ? `<img class="fes-event-img" src="${ev.image}" alt="${ev.name}">` : "";
      const boothLabel = currentLang === 'en' ? "Booth" : "Gian";
      const boothHtml = ev.booth ? `<span class="fes-booth-pill">${boothLabel} ${ev.booth}</span>` : "";
      const statusHtml = `<span class="fes-status-badge ${statusClass}">${statusLabel}</span>`;
      const contentHtml = ev.content ? `<div class="fes-event-desc">${ev.content}</div>` : "";

      return `
        <div class="fes-item">
          <div class="fes-date-col">${dateBlockHtml}</div>
          <div class="fes-dot-col"><span class="fes-dot"></span></div>
          <div class="fes-right-col">
            <div class="fes-date-mobile">${dateBlockHtml}</div>
            <div class="fes-content-box">
              ${imgHtml}
              <div class="fes-event-name">${(ev.name || '').toUpperCase()}</div>
              <div class="fes-meta-row">${boothHtml}${statusHtml}</div>
              ${contentHtml}
            </div>
          </div>
        </div>`;
    }).join('');

    container.innerHTML = `<div class="fes-timeline">${itemsHtml}</div>`;
  }

  function showToast(msg) {
    let t = document.getElementById('toastNotification') || document.createElement('div');
    t.id = 'toastNotification'; t.className = 'toast-notification';
    document.body.appendChild(t); t.innerText = msg;
    t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => t.classList.remove('show'), 2800);
  }

  function updateCartBadge() { document.getElementById('cartCount').innerText = cart.reduce((s, i) => s + i.quantity, 0); }
  function openCartModal() { clearErrors(); renderCart(); openModal('cartModal'); }

  function renderCart() {
    const container = document.getElementById('cartList');
    const btnSubmit = document.getElementById('btnSubmitOrder');
    if (cart.length === 0) {
      container.innerHTML = `<div style='text-align:center;padding:20px;color:#666;'>${currentLang === 'en' ? 'Your cart is empty...' : 'Ở đây trống trải quá...'}</div>`;
      document.getElementById('totalPrice').innerText = currentLang === 'en' ? "Total: 0đ" : "Tổng: 0đ";
      if (btnSubmit) { 
        btnSubmit.disabled = true; 
        btnSubmit.className = "btn btn-disabled"; 
        btnSubmit.innerText = currentLang === 'en' ? "Empty Cart" : "Giỏ hàng trống"; 
      }
      return;
    }
    if (btnSubmit) { 
      btnSubmit.disabled = false; 
      btnSubmit.className = "btn btn-success"; 
      btnSubmit.innerText = currentLang === 'en' ? "Place Order" : "Chốt đơn"; 
    }

    let total = 0;
    container.innerHTML = cart.map((item, idx) => {
      total += item.price * item.quantity;
      const itemName = currentLang === 'en' ? (item.nameEn || item.name) : item.name;
      return `
        <div class="cart-item">
          <div style="flex:1;"><b>${itemName}</b><br><small> ${item.option}</small><br><b style="color:#050a1d;">${Number(item.price).toLocaleString()}đ</b></div>
          <div class="qty-control" style="background: #ffffff !important;">
            <button class="qty-btn" onclick="updateCartQty(${idx},-1)">-</button>
            <input type="number" class="qty-input" value="${item.quantity}" readonly style="background: #ffffff !important;">
            <button class="qty-btn" onclick="updateCartQty(${idx},1)">+</button>
          </div>
          <button onclick="removeFromCart(${idx})" style="background:none;border:none;color:#050a1d;cursor:pointer;padding:8px;font-size:16px;">
            <i class="fa fa-trash"></i>
          </button>
        </div>`;
    }).join('');
    document.getElementById('totalPrice').innerText = `${currentLang === 'en' ? 'Total' : 'Tổng'}: ${total.toLocaleString()}đ`;
  }

  function updateCartQty(idx, delta) {
    if (delta > 0 && cart[idx].quantity + delta > cart[idx].stock) return showToast(TOAST_MSGS.limitStock(cart[idx].stock)[currentLang]);
    cart[idx].quantity += delta;
    if (cart[idx].quantity <= 0) cart.splice(idx, 1);
    updateCartBadge(); renderCart();
  }

  function removeFromCart(idx) { cart.splice(idx, 1); updateCartBadge(); renderCart(); }
  function openModal(id) { document.getElementById(id).style.display = 'flex'; }
  function closeModal(id) { document.getElementById(id).style.display = 'none'; }

  function clearErrors() {
    const errIdMap = { Email: 'errEmail', Facebook: 'errFb', PickupName: 'errPickupName', PickupDate: 'errPickupDate' };
    ['Email','Facebook','PickupName','PickupDate'].forEach(k => {
      let f = document.getElementById('cust' + k), e = document.getElementById(errIdMap[k]);
      if (f) f.classList.remove('input-error'); if (e) { e.innerText = ''; e.style.display = 'none'; }
    });
  }

  function showError(fId, eId, msg) {
    let e = document.getElementById(eId), f = document.getElementById(fId);
    if (e) { e.innerText = msg; e.style.display = 'block'; }
    if (f) { f.classList.add('input-error'); f.focus(); }
  }

  function submitOrder(e) {
    if (e) e.preventDefault();
    clearErrors();

    const emailElem = document.getElementById('custEmail');
    const email = emailElem ? emailElem.value.trim() : '';
    const fb = document.getElementById('custFacebook').value.trim();
    const pickupName = document.getElementById('custPickupName').value.trim();
    const pickupDate = document.getElementById('custPickupDate').value;
    const note = document.getElementById('custNote').value.trim();

    let valid = true;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailElem) {
      if (!email) {
        showError('custEmail', 'errEmail', TOAST_MSGS.errEmail[currentLang]);
        valid = false;
      } else if (!emailRegex.test(email)) {
        showError('custEmail', 'errEmail', TOAST_MSGS.errInvalidEmail[currentLang]);
        valid = false;
      }
    }

    if (!fb) { showError('custFacebook','errFb', TOAST_MSGS.errFb[currentLang]); valid = false; }
    if (!pickupName) { showError('custPickupName','errPickupName', TOAST_MSGS.errName[currentLang]); valid = false; }
    if (!pickupDate) { showError('custPickupDate','errPickupDate', TOAST_MSGS.errDate[currentLang]); valid = false; }

    if (!valid) return showToast(TOAST_MSGS.fillInfo[currentLang]);

    currentTempOrder.customerInfo = { email: email, facebook: fb, pickupName: pickupName, pickupDate: pickupDate, note: note };
    currentTempOrder.cartItems = [...cart];

    closeModal('cartModal');
    openModal('selectPaymentModal');
  }

  async function choosePaymentMethod(method) {
    closeModal('selectPaymentModal');

    let totalAmt = cart.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0), 0);
    currentTempOrder.totalAmount = totalAmt;
    currentTempOrder.paymentMethod = method;

    if (method === 'fes') {
      finishOrderFlow();
      try {
        await runGoogleScript('confirmAndSaveOrder', currentTempOrder.customerInfo, currentTempOrder.cartItems, "", totalAmt, "fes");
      } catch (err) {
        console.error("Lỗi khi ghi đơn hàng:", err);
      }
    } else if (method === 'transfer') {
      try {
        const res = await runGoogleScript('createOrderTemp', currentTempOrder.customerInfo, currentTempOrder.cartItems);
        currentTempOrder.orderId = res.orderId;
        currentTempOrder.totalAmount = res.totalAmount;
        document.getElementById('resTotalAmount').innerText = (Number(res.totalAmount) || 0).toLocaleString();
        document.getElementById('qrImg').src = res.qrUrl;
        openModal('paymentModal');
      } catch (err) {
        showToast((currentLang === 'en' ? "Error: " : "Lỗi: ") + err.message);
      }
    }
  }

  async function confirmPaymentDone() {
    closeModal('paymentModal');
    finishOrderFlow();

    try {
      await runGoogleScript('confirmAndSaveOrder', currentTempOrder.customerInfo, currentTempOrder.cartItems, currentTempOrder.orderId, currentTempOrder.totalAmount, "transfer");
    } catch (err) {
      console.error("Lỗi khi xác nhận chuyển khoản:", err);
    }
  }

  function finishOrderFlow() {
    const ticketData = {
      pickupName: currentTempOrder.customerInfo ? currentTempOrder.customerInfo.pickupName : '',
      pickupDate: currentTempOrder.customerInfo ? currentTempOrder.customerInfo.pickupDate : '',
      note: currentTempOrder.customerInfo ? currentTempOrder.customerInfo.note : '',
      items: currentTempOrder.cartItems || [],
      totalPrice: currentTempOrder.totalAmount || 0,
      paymentMethod: currentTempOrder.paymentMethod || 'fes'
    };

    populateTicketBill(ticketData);
    openModal('successModal');

    cart = [];          
    updateCartBadge();  
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function populateTicketBill(data) {
    if (!data) return;
    
    var now = new Date();
    var dateStr = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    var timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    
    var elDate = document.getElementById('ticketDate');
    if (elDate) elDate.innerText = dateStr;
    
    var elTime = document.getElementById('ticketTime');
    if (elTime) elTime.innerText = timeStr;

    var elPickupName = document.getElementById('ticketPickupName');
    if (elPickupName) elPickupName.innerText = data.pickupName || data.custName || 'N/A';

    var elPickupDate = document.getElementById('ticketPickupDate');
    if (elPickupDate) elPickupDate.innerText = data.pickupDate || 'N/A';

    var isEn = currentLang === 'en';
    var defaultOptText = isEn ? "Default" : "Mặc định";

    var itemListContainer = document.getElementById('ticketItemList');
    if (itemListContainer) {
      itemListContainer.innerHTML = '';

      var items = data.items || [];
      if (items.length > 0) {
        var groupedItems = {};
        items.forEach(function(item) {
          var prodName = (isEn && item.nameEn) ? item.nameEn : (item.name || '');
          if (!groupedItems[prodName]) {
            groupedItems[prodName] = [];
          }
          
          var optName = (isEn && item.optionEn) ? item.optionEn : (item.option || defaultOptText);

          groupedItems[prodName].push({
            option: optName,
            qty: item.qty || item.quantity || 1,
            price: item.price || 0
          });
        });

        for (var prodName in groupedItems) {
          var itemBlock = document.createElement('div');
          itemBlock.style.cssText = 'margin-bottom: 8px; font-size: 14px;';
          
          var titleHtml = `<div style="font-weight: bold; margin-bottom: 2px;">${prodName}</div>`;
          
          var optionsHtml = '';
          groupedItems[prodName].forEach(function(sub) {
            var subTotal = sub.price * sub.qty;
            optionsHtml += `
              <div style="display: flex; justify-content: space-between; align-items: center; padding-left: 12px; color: #333; font-size: 13px;">
                <span style="flex: 2; text-align: left; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 5px;">${sub.option}</span>
                <span style="flex: 1; text-align: center;">${sub.qty}</span>
                <span style="flex: 1.5; text-align: right;">${subTotal.toLocaleString('vi-VN')}đ</span>
              </div>`;
          });

          itemBlock.innerHTML = titleHtml + optionsHtml;
          itemListContainer.appendChild(itemBlock);
        }
      } else {
        itemListContainer.innerHTML = `<div style="text-align: center;">${isEn ? 'No items' : 'Không có sản phẩm'}</div>`;
      }
    }

    var noteRow = document.getElementById('ticketNoteRow');
    if (noteRow) {
      var noteVal = (data.note || '').trim();
      if (noteVal) {
        var noteLabel = isEn ? 'Note' : 'Ghi chú';
        noteRow.style.display = 'block';
        noteRow.innerHTML = '<b>' + noteLabel + ':</b> <i>' + escapeHtml(noteVal) + '</i>';
      } else {
        noteRow.style.display = 'none';
        noteRow.innerHTML = '';
      }
    }

    var total = data.totalPrice || 0;
    var elTotal = document.getElementById('ticketTotalPrice');
    if (elTotal) elTotal.innerText = total.toLocaleString('vi-VN') + ' VNĐ';

    var noteElement = document.getElementById('ticketPaymentNote');
    if (noteElement) {
      noteElement.style.textAlign = 'center';
      noteElement.style.fontStyle = 'italic';
      noteElement.style.display = 'block';
      noteElement.style.width = '100%';

      if (data.paymentMethod === 'fes') {
        noteElement.innerText = isEn ? 'Pay at Fes' : 'Trả tại Fes';
      } else if (data.paymentMethod === 'transfer') {
        noteElement.innerText = isEn ? 'Bank Transfer' : 'Chuyển khoản trước';
      } else {
        noteElement.innerText = data.paymentMethod || (isEn ? 'Pay at Fes' : 'Trả tại Fes');
      }
    }
  }

  function toggleLanguage() {
    currentLang = (currentLang === 'vi') ? 'en' : 'vi';

    const viBadge = document.getElementById('lang-vi');
    const enBadge = document.getElementById('lang-en');
    
    if (currentLang === 'vi') {
      viBadge.classList.add('active');
      enBadge.classList.remove('active');
    } else {
      enBadge.classList.add('active');
      viBadge.classList.remove('active');
    }

    renderProducts(productsData);
    if (currentSelectedProdIdx !== null) {
      openProductDetail(currentSelectedProdIdx);
    }

    const fesView = document.getElementById('fesCalendarView');
    if (fesView && fesView.style.display === 'block' && fesEventsData.length > 0) {
      renderFesTimeline(fesEventsData);
    }

    applyLanguageToDOM();
    renderCart();
  }

    document.addEventListener('DOMContentLoaded', () => {
      const mainImg = document.getElementById('detailMainImg');
      if (mainImg) {
        mainImg.addEventListener('click', function() {
          const lightbox = document.getElementById('imageLightbox');
          const lightboxImg = document.getElementById('lightboxImg');
          if (lightbox && lightboxImg) {
            lightboxImg.src = this.src;
            lightbox.style.display = 'flex';
          }
        });
      }
    });

    function closeImageLightbox() {
      const lightbox = document.getElementById('imageLightbox');
      if (lightbox) {
        lightbox.style.display = 'none';
      }
    }

  function applyLanguageToDOM() {
    const elements = document.querySelectorAll('[data-vi][data-en]');
    elements.forEach(function(el) {
      if (el && el.nodeType === 1 && el.children.length === 0) { 
        const text = el.getAttribute('data-' + currentLang);
        if (text !== null) el.innerText = text;
      }
    });

    const inputs = document.querySelectorAll('[data-ph-vi][data-ph-en]');
    inputs.forEach(function(el) {
      if (el && el.nodeType === 1) {
        const phText = el.getAttribute('data-ph-' + currentLang);
        if (phText !== null) el.setAttribute('placeholder', phText);
      }
    });

    const titleElements = document.querySelectorAll('[data-title-vi][data-title-en]');
    titleElements.forEach(function(el) {
      if (el && el.nodeType === 1) {
        const titleText = el.getAttribute('data-title-' + currentLang);
        if (titleText !== null) el.setAttribute('title', titleText);
      }
    });

    const selectOptions = document.querySelectorAll('option[data-vi][data-en]');
    selectOptions.forEach(function(opt) {
      const text = opt.getAttribute('data-' + currentLang);
      if (text !== null) opt.innerText = text;
    });
  }

  function filterProductsLocally() {
    const searchInput = document.getElementById('searchProductInput');
    if (!searchInput) return;
    
    const keyword = searchInput.value.toLowerCase().trim();
    
    if (!keyword) {
      renderProducts(productsData);
      return;
    }

    const filtered = productsData.filter(p => {
      const nameVi = (p.name || "").toLowerCase();
      const nameEn = (p.nameEn || "").toLowerCase();
      
      const matchName = nameVi.includes(keyword) || nameEn.includes(keyword);
      
      const matchOption = p.options && p.options.some(opt => 
        (opt.optionName || "").toLowerCase().includes(keyword)
      );

      return matchName || matchOption; 
    });

      renderProducts(filtered);
    }

    function downloadTicketImage() {
      const element = document.getElementById("ticketBillArea");
      if (!element) return;

      html2canvas(element, {
        scale: 2, 
        useCORS: true,
        logging: false
      }).then(canvas => {
        const link = document.createElement("a");
        link.download = `Ve_Fes_${new Date().getTime()}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
      }).catch(err => {
        console.error("Lỗi khi tải vé:", err);
        showToast(TOAST_MSGS.errTicket[currentLang]);
      });
  }
