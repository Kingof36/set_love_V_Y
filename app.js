// ⚠️ Sau khi Deploy code.gs, dán URL /exec vào đây:
const API_URL = "https://script.google.com/macros/s/AKfycbzZfiskRu1sgVFUU-cBd8tJcaK2aoNzv0nGwcZwmlrC7whmCp9iSycTeO6jHUfJCShy/exec";
const ADMIN_EMAIL = 'lengocnhu1805@gmail.com'; // email này tự thấy tab Admin khi đăng nhập; mật khẩu do chính admin đặt lúc đăng ký

let currentUser = null;
let currentChatUser = null;
let base64Media = "";
let mediaType = "";
let mediaRecorder = null;
let audioChunks = [];

// ---------- Trạng thái thông báo ----------
let pendingRequestsList = [];      // lời mời kết bạn đang chờ
let conversationsMap = {};         // email bạn (thường) -> { email, lastFrom, lastText, lastTime }
let notifRefreshTimer = null;

try {
  currentUser = JSON.parse(localStorage.getItem('friendbook_user')) || null;
} catch (e) {
  currentUser = null;
}

// ---------- Tiện ích chung ----------
const $ = (id) => document.getElementById(id);

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function api(action, payload) {
  const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action, ...payload }) });
  return res.json();
}

async function apiGet(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}?${qs}`);
  return res.json();
}

document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
  currentUser ? showMainApp() : showAuthScreen();

  $('register')?.addEventListener('click', handleRegister);
  $('login')?.addEventListener('click', handleLogin);
  $('logout')?.addEventListener('click', handleLogout);
  $('postBtn')?.addEventListener('click', handleCreatePost);
  $('sendBtn')?.addEventListener('click', sendMessage);
  $('searchFriendBtn')?.addEventListener('click', handleSearchFriends);
  $('sendSetLoveBtn')?.addEventListener('click', handleSendSetLoveRequest);
  $('awardBtn')?.addEventListener('click', () => handleAwardBadge('ngoan'));
  $('awardBadBtn')?.addEventListener('click', () => handleAwardBadge('hu'));
  $('resetRewardsBtn')?.addEventListener('click', handleResetRewards);
  $('closeModal')?.addEventListener('click', () => $('badgeModal').classList.add('hidden'));

  const imageInput = $('imageInput'), videoInput = $('videoInput');
  $('attachImageBtn')?.addEventListener('click', () => imageInput.click());
  imageInput?.addEventListener('change', (e) => handleMediaUpload(e, 'image'));
  $('attachVideoBtn')?.addEventListener('click', () => videoInput.click());
  videoInput?.addEventListener('change', (e) => handleMediaUpload(e, 'video'));
  $('recordVoiceBtn')?.addEventListener('click', toggleVoiceRecording);

  bindBackgroundPicker('chatBgInput', 'chatBoxContainer', 'chat_bg');
  bindBackgroundPicker('loveBgInput', 'setlove-active-section', 'love_bg');
  bindChatSwipe();

  document.querySelectorAll('.nav button[data-tab]').forEach((btn) => {
    btn.addEventListener('click', (e) => switchTab(e.currentTarget.getAttribute('data-tab')));
  });

  // Cho phép gửi tin nhắn bằng phím Enter
  $('message')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

function bindBackgroundPicker(inputId, targetId, storageKeyPrefix) {
  const input = $(inputId);
  if (!input) return;
  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bgUrl = evt.target.result;
      $(targetId).style.backgroundImage = `url(${bgUrl})`;
      try { localStorage.setItem(`${storageKeyPrefix}_${currentUser.email}`, bgUrl); } catch (err) {}
    };
    reader.readAsDataURL(file);
  });
}

function showMainApp() {
  $('auth').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('logout').classList.remove('hidden');
  $('who').textContent = `✨ Xin chào, ${currentUser.name || currentUser.email}`;

  if (currentUser.email === ADMIN_EMAIL) {
    $('adminTab').classList.remove('hidden');
    $('adminMobileTab')?.classList.remove('hidden');
    loadAdminUsers();
  }

  const savedChatBg = localStorage.getItem(`chat_bg_${currentUser.email}`);
  if (savedChatBg) $('chatBoxContainer').style.backgroundImage = `url(${savedChatBg})`;

  const savedLoveBg = localStorage.getItem(`love_bg_${currentUser.email}`);
  if (savedLoveBg) $('setlove-active-section').style.backgroundImage = `url(${savedLoveBg})`;

  switchTab('feed');
  checkRewardsNotification();
  refreshNotifications();
  if (notifRefreshTimer) clearInterval(notifRefreshTimer);
  notifRefreshTimer = setInterval(refreshNotifications, 15000);
}

function showAuthScreen() {
  $('auth').classList.remove('hidden');
  $('app').classList.add('hidden');
  $('logout').classList.add('hidden');
  $('who').textContent = '';
  if (notifRefreshTimer) { clearInterval(notifRefreshTimer); notifRefreshTimer = null; }
  try { localStorage.removeItem('friendbook_user'); } catch (e) {}
}

// ---------- Đăng ký / Đăng nhập ----------

async function handleRegister() {
  const name = $('name').value.trim();
  const email = $('email').value.trim();
  let password = $('password').value;
  const msg = $('authMsg');

  if (!name || !email || !password) {
    setMsg(msg, '⚠️ Vui lòng điền đủ thông tin!', '#ff4d4d');
    return;
  }

  setMsg(msg, '🔄 Đang đăng ký...', '#333');
  try {
    const result = await api('register', { name, email, password });
    if (result.status === 'success') {
      setMsg(msg, '🎉 Đăng ký thành công! Hãy đăng nhập.', '#28a745');
    } else {
      setMsg(msg, result.message, '#ff4d4d');
    }
  } catch (e) {
    setMsg(msg, '❌ Lỗi kết nối!', '#ff4d4d');
  }
}

async function handleLogin() {
  const email = $('email').value.trim();
  const password = $('password').value;
  const msg = $('authMsg');

  if (!email || !password) {
    setMsg(msg, '⚠️ Vui lòng nhập tài khoản!', '#ff4d4d');
    return;
  }
  setMsg(msg, '🔄 Đang đăng nhập...', '#333');
  try {
    const result = await api('login', { email, password });
    if (result.status === 'success') {
      currentUser = result.user;
      localStorage.setItem('friendbook_user', JSON.stringify(currentUser));
      setMsg(msg, '', '#333');
      showMainApp();
    } else {
      setMsg(msg, result.message, '#ff4d4d');
    }
  } catch (e) {
    setMsg(msg, '❌ Lỗi kết nối máy chủ!', '#ff4d4d');
  }
}

function setMsg(el, text, color) {
  if (!el) return;
  el.textContent = text;
  el.style.color = color;
}

function handleLogout() {
  currentUser = null;
  showAuthScreen();
}

function switchTab(tabName) {
  document.querySelectorAll('.view').forEach((v) => v.classList.add('hidden'));
  $(tabName)?.classList.remove('hidden');

  if (tabName === 'feed') loadFeed();
  if (tabName === 'chat') { closeChatFocus(); loadChatUsers(); }
  if (tabName === 'rewards') loadRewards();
  if (tabName === 'friends') loadFriendsData();
  if (tabName === 'setlove') loadSetLoveData();
  if (tabName === 'adminTab') loadAdminRewardsSummary();
}

// ---------- Bảng tin ----------

async function loadFeed() {
  const container = $('posts');
  if (!container) return;
  container.innerHTML = '<p class="empty-hint">⏳ Đang tải bảng tin...</p>';
  try {
    const result = await apiGet({ action: 'getPosts' });
    if (result.status === 'success') {
      container.innerHTML = result.posts.map((p) => `
        <div class="post-card">
          <b class="post-author">👤 ${escapeHtml(p.author)}</b>
          <p>${escapeHtml(p.content)}</p>
          <small>🕒 ${escapeHtml(p.time)}</small>
        </div>
      `).join('') || '<p class="empty-hint">Chưa có bài viết nào.</p>';
    }
  } catch (e) {
    container.innerHTML = '<p class="empty-hint error">Lỗi tải bảng tin.</p>';
  }
}

async function handleCreatePost() {
  const contentInput = $('postText');
  const content = contentInput.value.trim();
  if (!content) return;

  contentInput.value = '';
  try {
    await api('createPost', { email: currentUser.email, author: currentUser.name || currentUser.email, content });
  } catch (e) {
    alert('Không thể đăng bài viết!');
  } finally {
    loadFeed();
  }
}

// ---------- Bạn bè ----------

function loadFriendsData() {
  loadFriendRequests();
  loadMyFriends();
}

async function handleSearchFriends() {
  const keyword = $('searchFriendInput').value.trim();
  const resultsContainer = $('searchResults');
  if (!keyword) return;
  try {
    const result = await apiGet({ action: 'searchUsers', keyword, email: currentUser.email });
    if (result.status === 'success') {
      resultsContainer.innerHTML = result.users.map((u) => `
        <div class="list-row">
          <div><b>${escapeHtml(u.name)}</b><br><small>${escapeHtml(u.email)}</small></div>
          <button class="btn-primary btn-sm" onclick="sendFriendRequest('${escapeHtml(u.email)}')">Kết bạn</button>
        </div>
      `).join('') || '<p class="empty-hint">Không tìm thấy.</p>';
    }
  } catch (e) {}
}

async function sendFriendRequest(targetEmail) {
  try {
    const result = await api('sendFriendRequest', { from: currentUser.email, to: targetEmail });
    if (result.status === 'success') {
      alert('✨ Đã gửi lời mời kết bạn!');
    } else {
      alert('⚠️ ' + result.message);
    }
    loadFriendsData();
  } catch (e) {}
}

async function loadFriendRequests() {
  const container = $('requests');
  if (!container) return;
  try {
    const result = await apiGet({ action: 'getFriendRequests', email: currentUser.email });
    if (result.status === 'success') {
      container.innerHTML = result.requests.map((r) => `
        <div class="list-row">
          <div><b>${escapeHtml(r.name)}</b><br><small>${escapeHtml(r.email)}</small></div>
          <button class="btn-success btn-sm" onclick="acceptFriendRequest('${escapeHtml(r.email)}')">Chấp nhận</button>
        </div>
      `).join('') || '<p class="empty-hint">Không có lời mời kết bạn nào.</p>';
    }
  } catch (e) {}
}

async function acceptFriendRequest(fromEmail) {
  try {
    await api('acceptFriendRequest', { user1: currentUser.email, user2: fromEmail });
    alert('🎉 Đã kết bạn!');
    loadFriendsData();
  } catch (e) {}
}

async function loadMyFriends() {
  const container = $('myFriends');
  if (!container) return;
  try {
    const result = await apiGet({ action: 'getMyFriends', email: currentUser.email });
    if (result.status === 'success') {
      container.innerHTML = result.friends.map((f) => `
        <div class="list-row">
          <div><b>${escapeHtml(f.name)}</b><br><small>${escapeHtml(f.email)}</small></div>
          <button class="btn-primary btn-sm" onclick="switchTab('chat'); selectChatUser('${escapeHtml(f.email)}', '${escapeHtml(f.name)}');">Nhắn tin</button>
        </div>
      `).join('') || '<p class="empty-hint">Chưa có bạn bè.</p>';
    }
  } catch (e) {}
}

// ---------- Nhắn tin ----------

function handleMediaUpload(e, type) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (uploadEvent) => {
    base64Media = uploadEvent.target.result;
    mediaType = type;
    alert(`✨ Đã đính kèm ${type === 'image' ? 'ảnh' : 'video'}! Bấm Gửi.`);
  };
  reader.readAsDataURL(file);
  e.target.value = ''; // cho phép chọn lại cùng 1 file lần sau
}

function toggleVoiceRecording() {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        const reader = new FileReader();
        reader.onload = (e) => {
          base64Media = e.target.result;
          mediaType = 'voice';
          alert('🎙️ Đã ghi âm xong! Bấm Gửi.');
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorder.start();
      alert('🔴 Đang ghi âm... Bấm lại lần nữa để dừng.');
    }).catch(() => alert('⚠️ Không thể truy cập Micro!'));
  } else if (mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}

async function loadChatUsers() {
  const list = $('chatFriends');
  if (!list) return;
  try {
    const result = await apiGet({ action: 'getMyFriends', email: currentUser.email });
    if (result.status === 'success') {
      list.innerHTML = result.friends.map((u) => `
        <div class="chat-friend-item" data-email="${escapeHtml(u.email)}" onclick="selectChatUser('${escapeHtml(u.email)}', '${escapeHtml(u.name)}')">
          👤 ${escapeHtml(u.name)}
        </div>
      `).join('') || '<p class="empty-hint small">Chưa có bạn.</p>';
      renderChatUnreadDots();
    }
  } catch (e) {}
}

function bindChatSwipe() {
  const chatBody = $('chatBody');
  if (!chatBody) return;
  let startX = 0, startY = 0, tracking = false;

  chatBody.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  chatBody.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5) return; // phải là vuốt ngang rõ ràng
    if (dx < 0) {
      openChatFocus();
    } else {
      closeChatFocus();
    }
  }, { passive: true });
}

function openChatFocus() {
  if (!currentChatUser) return; // chỉ full màn hình khi đã chọn 1 cuộc chat
  $('chatBody')?.classList.add('chat-focused');
  $('backToListBtn')?.classList.remove('hidden');
}

function closeChatFocus() {
  $('chatBody')?.classList.remove('chat-focused');
  $('backToListBtn')?.classList.add('hidden');
}

function selectChatUser(email, name) {
  currentChatUser = email;
  $('chatTitleText').textContent = `Đang chat với: ${name}`;
  loadMessages();
}

function mediaHtmlFor(src) {
  if (!src || !src.startsWith('data:')) return '';
  if (src.startsWith('data:video')) return `<video controls class="chat-media"><source src="${src}"></video>`;
  if (src.startsWith('data:audio')) return `<audio controls class="chat-media"><source src="${src}"></audio>`;
  return `<img src="${src}" class="chat-media chat-media-img" />`;
}

async function loadMessages() {
  if (!currentChatUser) return;
  const msgContainer = $('messages');
  try {
    const result = await apiGet({ action: 'getMessages', user1: currentUser.email, user2: currentChatUser });
    if (result.status === 'success') {
      msgContainer.innerHTML = result.messages.map((m) => {
        const mine = m.from === currentUser.email;
        return `
          <div class="msg-row ${mine ? 'mine' : ''}">
            <div class="msg-bubble ${mine ? 'mine' : ''}">
              ${m.text ? `<p>${escapeHtml(m.text)}</p>` : ''}
              ${mediaHtmlFor(m.image)}
              <small>${escapeHtml(m.time)}</small>
            </div>
          </div>
        `;
      }).join('') || '<p class="empty-hint small">Chưa có tin nhắn.</p>';
      msgContainer.scrollTop = msgContainer.scrollHeight;

      if (result.messages.length) {
        markConversationSeen(currentChatUser, result.messages[result.messages.length - 1].time);
        renderNotifBadge();
        renderChatUnreadDots();
      }
    }
  } catch (e) {}
}

async function sendMessage() {
  const textInput = $('message');
  const text = textInput.value.trim();
  if ((!text && !base64Media) || !currentChatUser) return;

  const tempText = text, tempMedia = base64Media;
  textInput.value = '';
  base64Media = '';
  mediaType = '';

  try {
    await api('sendMessage', { from: currentUser.email, to: currentChatUser, text: tempText, image: tempMedia });
  } catch (e) {
  } finally {
    loadMessages();
  }
}

// ---------- Set Love ----------

async function loadSetLoveData() {
  const select = $('setlovePartnerSelect');
  if (select) {
    try {
      const result = await apiGet({ action: 'getMyFriends', email: currentUser.email });
      if (result.status === 'success') {
        select.innerHTML = result.friends.map((u) => `<option value="${escapeHtml(u.email)}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`).join('');
      }
    } catch (e) {}
  }
  checkLoveStatus();
}

async function handleSendSetLoveRequest() {
  const partnerEmail = $('setlovePartnerSelect').value;
  if (!partnerEmail) return alert('⚠️ Vui lòng chọn người bạn muốn Set Love!');

  try {
    const result = await api('sendSetLove', { from: currentUser.email, to: partnerEmail });
    if (result.status === 'success') {
      alert('💖 Đã Set Love thành công!');
      checkLoveStatus();
    } else {
      alert('⚠️ ' + result.message);
    }
  } catch (e) {}
}

async function checkLoveStatus() {
  try {
    const result = await apiGet({ action: 'getLoveStatus', email: currentUser.email });
    if (result.status === 'success' && result.isLoved) {
      $('setlove-request-section').classList.add('hidden');
      $('setlove-active-section').classList.remove('hidden');
      $('partnerName').textContent = result.partnerName;
      startLoveTimer(result.loveSince);
      initGlassJars(result.loveId, result.user1, result.user2);
    } else {
      $('setlove-request-section').classList.remove('hidden');
      $('setlove-active-section').classList.add('hidden');
    }
  } catch (e) {}
}

let currentLoveId = null;
let myJarKeyType = null;
let partnerJarKeyType = null;
let currentJarData = { user1: 3, user2: 3 };

function initGlassJars(loveId, user1, user2) {
  currentLoveId = loveId;
  const myEmail = String(currentUser.email || '').trim().toLowerCase();
  if (myEmail === String(user1 || '').trim().toLowerCase()) {
    myJarKeyType = 'user1';
    partnerJarKeyType = 'user2';
  } else {
    myJarKeyType = 'user2';
    partnerJarKeyType = 'user1';
  }
  fetchJarStatus();
}

async function fetchJarStatus() {
  if (!currentLoveId) return;
  try {
    const result = await apiGet({ action: 'getLoveStatus', email: currentUser.email });
    if (result.status === 'success' && result.isLoved) {
      currentJarData.user1 = Number(result.jar1 ?? 3);
      currentJarData.user2 = Number(result.jar2 ?? 3);
      renderJars();
    }
  } catch (e) {}
}

function renderJars() {
  const myJar = $('myGlassJar'), partnerJar = $('partnerGlassJar');
  const myCount = currentJarData[myJarKeyType] ?? 0;
  const partnerCount = currentJarData[partnerJarKeyType] ?? 0;
  if (myJar) fillJar(myJar, myCount);
  if (partnerJar) fillJar(partnerJar, partnerCount);
  if ($('myJarCount')) $('myJarCount').textContent = myCount;
  if ($('partnerJarCount')) $('partnerJarCount').textContent = partnerCount;
}

function fillJar(jar, count) {
  jar.innerHTML = '';
  for (let i = 0; i < count; i++) createFloatingHeart(jar);
}

function createFloatingHeart(jar) {
  const heart = document.createElement('div');
  heart.className = 'floating-heart';
  heart.textContent = '💔';
  heart.style.left = Math.random() * 110 + 'px';
  heart.style.top = Math.random() * 160 + 'px';
  jar.appendChild(heart);
}

/** Lưu số lượng tim lên server; trả về true nếu lưu thành công. */
async function updateJarOnServer(newCount) {
  if (!currentLoveId) return false;
  try {
    const result = await api('updateJar', { loveId: currentLoveId, userType: myJarKeyType, count: newCount });
    return result.status === 'success';
  } catch (e) {
    return false;
  }
}

async function addBrokenHeart(target) {
  if (!currentLoveId) return;
  if (target !== 'my') return alert('⚠️ Bạn chỉ có thể tương tác với hũ trái tim của chính mình!');
  const previous = currentJarData[myJarKeyType];
  currentJarData[myJarKeyType] = previous + 1;
  renderJars();
  const saved = await updateJarOnServer(currentJarData[myJarKeyType]);
  if (!saved) {
    currentJarData[myJarKeyType] = previous;
    renderJars();
    alert('⚠️ Không lưu được thay đổi, vui lòng thử lại!');
  }
}

async function removeBrokenHeart(target) {
  if (!currentLoveId) return;
  if (target !== 'my') return alert('⚠️ Bạn chỉ có thể tương tác với hũ trái tim của chính mình!');
  const previous = currentJarData[myJarKeyType];
  currentJarData[myJarKeyType] = Math.max(0, previous - 1);
  renderJars();
  const saved = await updateJarOnServer(currentJarData[myJarKeyType]);
  if (!saved) {
    currentJarData[myJarKeyType] = previous;
    renderJars();
    alert('⚠️ Không lưu được thay đổi, vui lòng thử lại!');
  }
}

setInterval(() => {
  if (currentLoveId && !$('setlove')?.classList.contains('hidden')) fetchJarStatus();
}, 3000);

function startLoveTimer(startDateStr) {
  const startDate = new Date(startDateStr || Date.now());
  setInterval(() => {
    const diff = new Date() - startDate;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff / 3600000) % 24);
    const minutes = Math.floor((diff / 60000) % 60);
    const seconds = Math.floor((diff / 1000) % 60);
    const timerEl = $('loveTimer');
    if (timerEl) timerEl.textContent = `⏳ Đã yêu nhau: ${days} ngày ${hours} giờ ${minutes} phút ${seconds} giây`;
  }, 1000);
}

// ---------- Phiếu bé ngoan / hư ----------

async function checkRewardsNotification() {
  try {
    const result = await apiGet({ action: 'getRewards', email: currentUser.email });
    if (result.status === 'success') {
      const lastCount = parseInt(localStorage.getItem('last_reward_count') || 0, 10);
      if (result.count > lastCount) {
        $('badgeModal').classList.remove('hidden');
        localStorage.setItem('last_reward_count', result.count);
      }
    }
  } catch (e) {}
}

// ---------- Thông báo (chuông) ----------

function seenKey(friendEmail) {
  return `chat_seen_${currentUser.email}_${friendEmail}`.toLowerCase();
}

function markConversationSeen(friendEmail, lastTime) {
  if (!friendEmail || !lastTime) return;
  try { localStorage.setItem(seenKey(friendEmail), lastTime); } catch (e) {}
}

function isConversationUnread(convo) {
  if (!convo || !convo.lastFrom) return false;
  if (String(convo.lastFrom).toLowerCase() === String(currentUser.email).toLowerCase()) return false; // tin nhắn cuối là của mình gửi
  try { return localStorage.getItem(seenKey(convo.email)) !== convo.lastTime; } catch (e) { return true; }
}

async function refreshNotifications() {
  if (!currentUser) return;
  try {
    const [reqResult, convoResult] = await Promise.all([
      apiGet({ action: 'getFriendRequests', email: currentUser.email }),
      apiGet({ action: 'getConversationsSummary', email: currentUser.email })
    ]);
    pendingRequestsList = reqResult.status === 'success' ? reqResult.requests : [];
    conversationsMap = {};
    if (convoResult.status === 'success') {
      convoResult.conversations.forEach((c) => { conversationsMap[String(c.email).toLowerCase()] = c; });
    }
  } catch (e) {}
  renderNotifBadge();
  renderChatUnreadDots();
}

function renderNotifBadge() {
  const unreadConvoCount = Object.values(conversationsMap).filter(isConversationUnread).length;
  const total = pendingRequestsList.length + unreadConvoCount;
  const badge = $('notifBadge');
  if (!badge) return;
  if (total > 0) {
    badge.textContent = total > 9 ? '9+' : total;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function toggleNotifPanel() {
  const panel = $('notifPanel');
  if (!panel) return;
  const opening = panel.classList.contains('hidden');
  panel.classList.toggle('hidden');
  if (opening) renderNotifPanel();
}

function renderNotifPanel() {
  const panel = $('notifPanel');
  if (!panel) return;
  const unreadConvos = Object.values(conversationsMap).filter(isConversationUnread);
  const items = [];

  pendingRequestsList.forEach((r) => {
    items.push(`<button class="notif-item" onclick="closeNotifAnd('friends')">👥 <b>${escapeHtml(r.name)}</b> gửi lời mời kết bạn</button>`);
  });
  unreadConvos.forEach((c) => {
    items.push(`<button class="notif-item" onclick="closeNotifAndOpenChat('${escapeHtml(c.email)}', '${escapeHtml(c.email)}')">💬 Tin nhắn mới: ${escapeHtml(c.lastText || '').slice(0, 40)}</button>`);
  });

  panel.innerHTML = items.join('') || '<div class="notif-empty">Không có thông báo mới.</div>';
}

function closeNotifAnd(tabName) {
  $('notifPanel')?.classList.add('hidden');
  switchTab(tabName);
}

function closeNotifAndOpenChat(email, name) {
  $('notifPanel')?.classList.add('hidden');
  switchTab('chat');
  selectChatUser(email, name);
}

function renderChatUnreadDots() {
  document.querySelectorAll('.chat-friend-item').forEach((el) => {
    const email = el.getAttribute('data-email');
    const convo = conversationsMap[String(email).toLowerCase()];
    const dot = el.querySelector('.unread-dot');
    if (convo && isConversationUnread(convo)) {
      if (!dot) el.insertAdjacentHTML('beforeend', '<span class="unread-dot"></span>');
    } else if (dot) {
      dot.remove();
    }
  });
}

document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.notif-wrap');
  if (wrap && !wrap.contains(e.target)) $('notifPanel')?.classList.add('hidden');
});

async function loadRewards() {
  try {
    const result = await apiGet({ action: 'getRewards', email: currentUser.email });
    if (result.status === 'success') {
      $('weekCount').textContent = result.count;
      $('rewardHistory').innerHTML = result.history.map((h) => {
        const isBad = h.type === 'hu';
        const icon = isBad ? '⚠️' : '⭐';
        const titleText = isBad ? 'Nhận 1 phiếu bé hư' : 'Nhận 1 phiếu bé ngoan';
        return `<div class="reward-item ${isBad ? 'bad' : 'good'}">${icon} ${titleText} lúc ${escapeHtml(h.time)}<br><small>Lý do: ${escapeHtml(h.reason)}</small></div>`;
      }).join('') || '<p class="empty-hint small">Chưa có phiếu nào.</p>';
    }
  } catch (e) {}
}

// ---------- Admin ----------

async function loadAdminUsers() {
  const select = $('awardUser');
  if (!select) return;
  try {
    const result = await apiGet({ action: 'getUsers' });
    if (result.status === 'success') {
      select.innerHTML = result.users.map((u) => `<option value="${escapeHtml(u.email)}">${escapeHtml(u.name)} (${escapeHtml(u.email)})</option>`).join('');
    }
  } catch (e) {}
}

async function handleAwardBadge(type) {
  const email = $('awardUser').value;
  const reason = $('awardReason').value.trim();
  const msg = $('adminMsg');
  const actionName = type === 'hu' ? 'awardBadBadge' : 'awardBadge';

  try {
    const result = await api(actionName, { email, reason });
    if (result.status === 'success') {
      setMsg(msg, type === 'hu' ? '⚠️ Đã phát phiếu bé hư thành công!' : '🎉 Phát phiếu bé ngoan thành công!', '#28a745');
      $('awardReason').value = '';
      loadAdminRewardsSummary();
    } else {
      setMsg(msg, '❌ Lỗi phát phiếu.', '#ff4d4d');
    }
  } catch (e) {
    setMsg(msg, '❌ Lỗi kết nối.', '#ff4d4d');
  }
}

async function loadAdminRewardsSummary() {
  const container = $('adminRewardsSummary');
  if (!container) return;
  container.innerHTML = '<p class="empty-hint">⏳ Đang tải...</p>';
  try {
    const result = await apiGet({ action: 'getAllRewardsSummary' });
    if (result.status === 'success') {
      const rows = result.summary.map((u) => `
        <tr>
          <td>${escapeHtml(u.name)}<br><small>${escapeHtml(u.email)}</small></td>
          <td class="count-good">⭐ ${u.ngoan}</td>
          <td class="count-bad">⚠️ ${u.hu}</td>
        </tr>
      `).join('');
      container.innerHTML = `
        <table class="rewards-table">
          <thead><tr><th>Thành viên</th><th>Bé ngoan</th><th>Bé hư</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="3">Chưa có dữ liệu.</td></tr>'}</tbody>
        </table>
      `;
    }
  } catch (e) {
    container.innerHTML = '<p class="empty-hint error">Lỗi tải thống kê.</p>';
  }
}

async function handleResetRewards() {
  const select = $('awardUser');
  const email = select?.value;
  const name = select?.options[select.selectedIndex]?.text || email;
  if (!email) return;
  if (!confirm(`Xoá sạch toàn bộ phiếu bé ngoan/bé hư của "${name}"? Không thể hoàn tác.`)) return;

  const msg = $('adminMsg');
  try {
    const result = await api('resetRewards', { email });
    if (result.status === 'success') {
      setMsg(msg, `🔄 Đã reset phiếu cho ${name}.`, '#28a745');
      loadAdminRewardsSummary();
    } else {
      setMsg(msg, '❌ Lỗi khi reset.', '#ff4d4d');
    }
  } catch (e) {
    setMsg(msg, '❌ Lỗi kết nối.', '#ff4d4d');
  }
}
