(function () {
  'use strict';

  var STORAGE_KEY = 'RoxPosPocketSession';

  var state = {
    token: '',
    deviceId: '',
    catalog: null,
    cart: {},
    category: 'all',
    channel: 'SUR_PLACE',
    tableNumber: '',
    livreurId: '',
    phone: '',
    address: '',
    note: '',
  };

  var el = {
    brandLabel: document.getElementById('brand-label'),
    brandName: document.getElementById('brand-name'),
    resetBtn: document.getElementById('reset-btn'),
    pinInput: document.getElementById('pin-input'),
    labelInput: document.getElementById('label-input'),
    pairBtn: document.getElementById('pair-btn'),
    pairError: document.getElementById('pair-error'),
    categoryChips: document.getElementById('category-chips'),
    productList: document.getElementById('product-list'),
    channelChips: document.getElementById('channel-chips'),
    tableField: document.getElementById('table-field'),
    tableSelect: document.getElementById('table-select'),
    driverField: document.getElementById('driver-field'),
    driverSelect: document.getElementById('driver-select'),
    phoneField: document.getElementById('phone-field'),
    phoneInput: document.getElementById('phone-input'),
    addressField: document.getElementById('address-field'),
    addressInput: document.getElementById('address-input'),
    noteInput: document.getElementById('note-input'),
    submitBtn: document.getElementById('submit-btn'),
    submitError: document.getElementById('submit-error'),
    cartbar: document.getElementById('cartbar'),
    cartCount: document.getElementById('cart-count'),
    cartTotal: document.getElementById('cart-total'),
    clearBtn: document.getElementById('clear-btn'),
    checkoutBtn: document.getElementById('checkout-btn'),
    doneDetail: document.getElementById('done-detail'),
    againBtn: document.getElementById('again-btn'),
    ordersBtn: document.getElementById('orders-btn'),
    ordersNewBtn: document.getElementById('orders-new-btn'),
    statsGrid: document.getElementById('stats-grid'),
    orderList: document.getElementById('order-list'),
    ordersError: document.getElementById('orders-error'),
  };

  var screens = {
    pair: document.getElementById('screen-pair'),
    menu: document.getElementById('screen-menu'),
    checkout: document.getElementById('screen-checkout'),
    done: document.getElementById('screen-done'),
    orders: document.getElementById('screen-orders'),
  };

  function showScreen(name) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle('hidden', key !== name);
    });
    el.cartbar.hidden = name !== 'menu' && name !== 'checkout';
    el.resetBtn.hidden = name === 'pair';
    el.ordersBtn.hidden = name === 'pair' || name === 'orders';
  }

  function api(path, options) {
    options = options || {};
    var headers = { 'Content-Type': 'application/json' };
    if (state.token) {
      headers.Authorization = 'Bearer ' + state.token;
    }
    return fetch(path, {
      method: options.method || 'GET',
      headers: headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    }).then(function (response) {
      return response.json().catch(function () {
        return {};
      }).then(function (payload) {
        if (!response.ok) {
          var error = new Error(payload && payload.error ? payload.error : 'Erreur reseau');
          error.status = response.status;
          throw error;
        }
        return payload;
      });
    });
  }

  function money(value) {
    var currency = state.catalog && state.catalog.currency ? state.catalog.currency : 'DH';
    return Number(value || 0).toFixed(2) + ' ' + currency;
  }

  function persistSession(token, deviceId) {
    state.token = token || '';
    state.deviceId = deviceId || '';
    if (state.token) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: state.token, deviceId: state.deviceId }));
      } catch (error) {
        /* storage unavailable */
      }
    }
  }

  function readSession() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed.token === 'string' && parsed.token) {
        return parsed;
      }
    } catch (error) {
      /* ignore */
    }
    return null;
  }

  function clearSession() {
    state.token = '';
    state.deviceId = '';
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      /* ignore */
    }
  }

  function loadCatalog() {
    return api('/api/catalog').then(function (catalog) {
      state.catalog = catalog;
      state.category = 'all';
      if (catalog && catalog.businessName) {
        el.brandName.textContent = catalog.businessName;
        el.brandLabel.textContent = 'Caisse mobile';
      }
      renderMenu();
      showScreen('menu');
    });
  }

  function renderMenu() {
    var catalog = state.catalog || { categories: [], products: [] };
    var products = catalog.products || [];
    var categories = catalog.categories || [];

    el.categoryChips.innerHTML = '';
    var allChip = document.createElement('button');
    allChip.type = 'button';
    allChip.className = 'chip' + (state.category === 'all' ? ' active' : '');
    allChip.textContent = 'Tout';
    allChip.addEventListener('click', function () {
      state.category = 'all';
      renderMenu();
    });
    el.categoryChips.appendChild(allChip);

    categories
      .filter(function (category) {
        return products.some(function (product) {
          return product.categoryId === category.id;
        });
      })
      .forEach(function (category) {
        var chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'chip' + (state.category === category.id ? ' active' : '');
        chip.textContent = category.name;
        chip.addEventListener('click', function () {
          state.category = category.id;
          renderMenu();
        });
        el.categoryChips.appendChild(chip);
      });

    var visible = products.filter(function (product) {
      return state.category === 'all' || product.categoryId === state.category;
    });

    el.productList.innerHTML = '';
    if (visible.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Aucun produit disponible.';
      el.productList.appendChild(empty);
    }

    visible.forEach(function (product) {
      var quantity = state.cart[product.id] || 0;
      var row = document.createElement('div');
      row.className = 'product';

      var info = document.createElement('div');
      info.className = 'product-info';
      var name = document.createElement('strong');
      name.textContent = product.name;
      var price = document.createElement('span');
      price.textContent = money(product.price);
      info.appendChild(name);
      info.appendChild(price);

      var stepper = document.createElement('div');
      stepper.className = 'stepper';

      if (quantity > 0) {
        var minus = document.createElement('button');
        minus.type = 'button';
        minus.textContent = '\u2212';
        minus.addEventListener('click', function () {
          changeQuantity(product.id, -1);
        });

        var qty = document.createElement('span');
        qty.className = 'qty';
        qty.textContent = String(quantity);

        var plus = document.createElement('button');
        plus.type = 'button';
        plus.textContent = '+';
        plus.addEventListener('click', function () {
          changeQuantity(product.id, 1);
        });

        stepper.appendChild(minus);
        stepper.appendChild(qty);
        stepper.appendChild(plus);
      } else {
        var add = document.createElement('button');
        add.type = 'button';
        add.className = 'add';
        add.textContent = '+';
        add.addEventListener('click', function () {
          changeQuantity(product.id, 1);
        });
        stepper.appendChild(add);
      }

      row.appendChild(info);
      row.appendChild(stepper);
      el.productList.appendChild(row);
    });
  }

  function changeQuantity(productId, delta) {
    var next = (state.cart[productId] || 0) + delta;
    if (next <= 0) {
      delete state.cart[productId];
    } else {
      state.cart[productId] = next;
    }
    renderMenu();
    renderCart();
  }

  function cartTotals() {
    var catalog = state.catalog || { products: [] };
    var count = 0;
    var total = 0;
    Object.keys(state.cart).forEach(function (productId) {
      var quantity = state.cart[productId];
      var product = (catalog.products || []).find(function (item) {
        return item.id === productId;
      });
      count += quantity;
      if (product) {
        total += product.price * quantity;
      }
    });
    return { count: count, total: total };
  }

  function renderCart() {
    var totals = cartTotals();
    el.cartCount.textContent = totals.count + (totals.count === 1 ? ' article' : ' articles');
    el.cartTotal.textContent = money(totals.total);
    el.cartbar.hidden = totals.count === 0 || (screens.menu.classList.contains('hidden') && screens.checkout.classList.contains('hidden'));
  }

  var CHANNEL_LABELS = {
    SUR_PLACE: 'Sur place',
    EMPORTER: 'A emporter',
    LIVRAISON: 'Livraison',
  };

  function renderStats(stats) {
    var safe = stats || { orderCount: 0, paidCount: 0, unpaidCount: 0, totalCollected: 0 };
    var cells = [
      { label: 'Commandes', value: String(safe.orderCount || 0) },
      { label: 'Payees', value: String(safe.paidCount || 0) },
      { label: 'Impayees', value: String(safe.unpaidCount || 0) },
      { label: 'Encaisse', value: money(safe.totalCollected || 0) },
    ];
    el.statsGrid.innerHTML = '';
    cells.forEach(function (cell) {
      var box = document.createElement('div');
      box.className = 'stat';
      var value = document.createElement('strong');
      value.textContent = cell.value;
      var label = document.createElement('span');
      label.textContent = cell.label;
      box.appendChild(value);
      box.appendChild(label);
      el.statsGrid.appendChild(box);
    });
  }

  function renderOrders(payload) {
    var orders = (payload && payload.orders) || [];
    renderStats(payload && payload.stats);
    el.orderList.innerHTML = '';

    if (orders.length === 0) {
      var empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'Aucune commande pour cet appareil.';
      el.orderList.appendChild(empty);
      return;
    }

    orders.forEach(function (order) {
      var row = document.createElement('div');
      row.className = 'order' + (order.status === 'PAID' ? ' paid' : '');

      var head = document.createElement('div');
      head.className = 'order-head';
      var id = document.createElement('strong');
      id.className = 'order-id';
      id.textContent = order.orderNumber;
      var total = document.createElement('span');
      total.className = 'order-total';
      total.textContent = money(order.total);
      head.appendChild(id);
      head.appendChild(total);

      var meta = document.createElement('div');
      meta.className = 'order-meta';
      var bits = [CHANNEL_LABELS[order.channel] || order.channel];
      if (order.tableNumber) bits.push('Table ' + order.tableNumber);
      bits.push(order.status === 'PAID' ? 'Payee' : 'Impayee');
      meta.textContent = bits.join(' \u00b7 ');

      row.appendChild(head);
      row.appendChild(meta);

      if (order.status !== 'PAID') {
        var actions = document.createElement('div');
        actions.className = 'order-actions';

        var method = document.createElement('select');
        var cash = document.createElement('option');
        cash.value = 'CASH';
        cash.textContent = 'Especes';
        var card = document.createElement('option');
        card.value = 'CARD';
        card.textContent = 'Carte';
        method.appendChild(cash);
        method.appendChild(card);

        var payBtn = document.createElement('button');
        payBtn.type = 'button';
        payBtn.className = 'primary small';
        payBtn.textContent = 'Encaisser & imprimer';
        payBtn.addEventListener('click', function () {
          payOrder(order.orderId, method.value, payBtn);
        });

        actions.appendChild(method);
        actions.appendChild(payBtn);
        row.appendChild(actions);
      }

      el.orderList.appendChild(row);
    });
  }

  function loadOrders() {
    el.ordersError.hidden = true;
    return api('/api/orders')
      .then(function (payload) {
        renderOrders(payload);
        showScreen('orders');
      })
      .catch(function (error) {
        if (error.status === 401) {
          handleUnauthorized();
          return;
        }
        showScreen('orders');
        el.ordersError.textContent = error.message || 'Chargement impossible.';
        el.ordersError.hidden = false;
      });
  }

  function payOrder(orderId, paymentMethod, button) {
    if (button) button.disabled = true;
    el.ordersError.hidden = true;
    api('/api/pay', { method: 'POST', body: { orderId: orderId, paymentMethod: paymentMethod } })
      .then(function (result) {
        if (!result || !result.ok) {
          el.ordersError.textContent =
            (result && result.error) || "Le paiement n'a pas pu etre effectue.";
          el.ordersError.hidden = false;
          return;
        }
        return loadOrders();
      })
      .catch(function (error) {
        if (error.status === 401) {
          handleUnauthorized();
          return;
        }
        el.ordersError.textContent = error.message || "Le paiement n'a pas pu etre effectue.";
        el.ordersError.hidden = false;
      })
      .then(function () {
        if (button) button.disabled = false;
      });
  }

  function setChannel(channel) {
    state.channel = channel;
    Array.prototype.forEach.call(el.channelChips.children, function (chip) {
      chip.classList.toggle('active', chip.getAttribute('data-channel') === channel);
    });
    el.tableField.hidden = channel !== 'SUR_PLACE';
    el.driverField.hidden = channel !== 'LIVRAISON';
    el.phoneField.hidden = channel !== 'LIVRAISON';
    el.addressField.hidden = channel !== 'LIVRAISON';
  }

  function fillTables() {
    var tables = (state.catalog && state.catalog.tables) || [];
    el.tableSelect.innerHTML = '';
    tables.forEach(function (table) {
      var option = document.createElement('option');
      option.value = table.number;
      option.textContent = table.label || ('Table ' + table.number);
      el.tableSelect.appendChild(option);
    });
  }

  function fillDrivers() {
    var drivers = (state.catalog && state.catalog.drivers) || [];
    el.driverSelect.innerHTML = '';
    drivers.forEach(function (driver) {
      var option = document.createElement('option');
      option.value = driver.id;
      option.textContent = driver.name || ('Livreur ' + driver.number);
      el.driverSelect.appendChild(option);
    });
  }

  function openCheckout() {
    if (cartTotals().count === 0) {
      return;
    }
    fillTables();
    fillDrivers();
    setChannel(state.channel);
    el.phoneInput.value = state.phone;
    el.addressInput.value = state.address;
    el.noteInput.value = state.note;
    el.submitError.hidden = true;
    showScreen('checkout');
    renderCart();
  }

  function buildOrderPayload() {
    var lines = Object.keys(state.cart).map(function (productId) {
      return { productId: productId, quantity: state.cart[productId] };
    });
    var payload = {
      channel: state.channel,
      note: el.noteInput.value.trim() || undefined,
      lines: lines,
    };
    if (state.channel === 'SUR_PLACE') {
      payload.tableNumber = el.tableSelect.value || undefined;
    }
    if (state.channel === 'LIVRAISON') {
      payload.livreurId = el.driverSelect.value || undefined;
      payload.customerPhone = el.phoneInput.value.trim() || undefined;
      payload.deliveryAddress = el.addressInput.value.trim() || undefined;
    }
    return payload;
  }

  function submitOrder() {
    if (state.channel === 'SUR_PLACE' && !el.tableSelect.value) {
      showSubmitError('Selectionnez une table.');
      return;
    }
    if (state.channel === 'LIVRAISON' && !el.driverSelect.value) {
      showSubmitError('Selectionnez un livreur.');
      return;
    }

    el.submitBtn.disabled = true;
    el.submitError.hidden = true;
    state.note = el.noteInput.value;
    state.phone = el.phoneInput.value;
    state.address = el.addressInput.value;

    api('/api/orders', { method: 'POST', body: buildOrderPayload() })
      .then(function (result) {
        if (!result || !result.ok) {
          showSubmitError((result && result.error) || "La commande n'a pas pu etre envoyee.");
          return;
        }
        state.cart = {};
        renderMenu();
        renderCart();
        el.doneDetail.textContent =
          'N\u00b0 ' + (result.orderNumber || '') + ' \u00b7 ' + money(result.total || 0);
        showScreen('done');
      })
      .catch(function (error) {
        if (error.status === 401) {
          handleUnauthorized();
          return;
        }
        showSubmitError(error.message || "La commande n'a pas pu etre envoyee.");
      })
      .then(function () {
        el.submitBtn.disabled = false;
      });
  }

  function showSubmitError(message) {
    el.submitError.textContent = message;
    el.submitError.hidden = false;
  }

  function pair() {
    var pin = el.pinInput.value.trim();
    if (!/^\d{4,8}$/.test(pin)) {
      el.pairError.textContent = 'Saisissez le code affiche sur la caisse.';
      el.pairError.hidden = false;
      return;
    }

    el.pairBtn.disabled = true;
    el.pairError.hidden = true;

    api('/api/pair', {
      method: 'POST',
      body: { pin: pin, label: el.labelInput.value.trim() || undefined },
    })
      .then(function (result) {
        persistSession(result.token, result.deviceId);
        if (result.businessName) {
          el.brandName.textContent = result.businessName;
        }
        return loadCatalog();
      })
      .catch(function (error) {
        el.pairError.textContent =
          error.status === 401 ? 'Code incorrect.' : error.message || 'Connexion impossible.';
        el.pairError.hidden = false;
      })
      .then(function () {
        el.pairBtn.disabled = false;
      });
  }

  function handleUnauthorized() {
    clearSession();
    el.pinInput.value = '';
    showScreen('pair');
  }

  function boot() {
    Array.prototype.forEach.call(el.channelChips.children, function (chip) {
      chip.addEventListener('click', function () {
        setChannel(chip.getAttribute('data-channel'));
      });
    });
    el.pairBtn.addEventListener('click', pair);
    el.pinInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') pair();
    });
    el.checkoutBtn.addEventListener('click', openCheckout);
    el.clearBtn.addEventListener('click', function () {
      state.cart = {};
      renderMenu();
      renderCart();
    });
    el.submitBtn.addEventListener('click', submitOrder);
    el.againBtn.addEventListener('click', function () {
      showScreen('menu');
      renderCart();
    });
    el.ordersBtn.addEventListener('click', function () {
      loadOrders();
    });
    el.ordersNewBtn.addEventListener('click', function () {
      showScreen('menu');
      renderCart();
    });
    el.resetBtn.addEventListener('click', function () {
      clearSession();
      handleUnauthorized();
    });

    api('/api/info')
      .then(function (info) {
        if (info && info.businessName) {
          el.brandName.textContent = info.businessName;
        }
      })
      .catch(function () {
        /* ignore */
      });

    var session = readSession();
    if (session) {
      persistSession(session.token, session.deviceId);
      loadCatalog().catch(function () {
        handleUnauthorized();
      });
    } else {
      showScreen('pair');
    }
  }

  boot();
})();
