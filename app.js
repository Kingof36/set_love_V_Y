const API_URL = "https://script.google.com/macros/s/AKfycby6XC0i6ehOJkgCQPle9ulCjal7Cfm7Lf0BK3k2g5wWLFsr8blNmRez2Ik404hPsY9Odw/exec";

let currentUser = null;
let currentChatUser = null;
let base64Media = ""; 
let mediaType = "";  
let mediaRecorder = null;
let audioChunks = [];

try {
  currentUser = JSON.parse(localStorage.getItem('friendbook_user')) || null;
} catch (e) {
  currentUser = null;
}

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  if (currentUser) {
    showMainApp();
  } else {
    showAuthScreen();
  }

  const regBtn = document.getElementById('register');
  const logBtn = document.getElementById('login');
  const logOutBtn = document.getElementById('logout');
  if (regBtn) regBtn.addEventListener('click', handleRegister);
  if (logBtn) logBtn.addEventListener('click', handleLogin);
  if (logOutBtn) logOutBtn.addEventListener('click', handleLogout);

  const postBtn = document.getElementById('postBtn');
  if (postBtn) postBtn.addEventListener('click', handleCreatePost);

  const sendBtn = document.getElementById('sendBtn');
  const attachImageBtn = document.getElementById('attachImageBtn');
  const imageInput = document.getElementById('imageInput');
  const attachVideoBtn = document.getElementById('attachVideoBtn');
  const videoInput = document.getElementById('videoInput');
  const recordVoiceBtn = document.getElementById('recordVoiceBtn');

  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (attachImageBtn && imageInput) {
    attachImageBtn.addEventListener('click', () => imageInput.click());
    imageInput.addEventListener('change', (e) => handleMediaUpload(e, 'image'));
  }
  if (attachVideoBtn && videoInput) {
    attachVideoBtn.addEventListener('click', () => videoInput.click());
    videoInput.addEventListener('change', (e) => handleMediaUpload(e, 'video'));
  }
  if (recordVoiceBtn) {
    recordVoiceBtn.addEventListener('click', toggleVoiceRecording);
  }

  const searchBtn = document.getElementById('searchFriendBtn');
  if (searchBtn) searchBtn.addEventListener('click', handleSearchFriends);

  const sendLoveBtn = document.getElementById('sendSetLoveBtn');
  if (sendLoveBtn) {
    sendLoveBtn.addEventListener('click', handleSendSetLoveRequest);
  }

  const awardBtn = document.getElementById('awardBtn');
  if (awardBtn) awardBtn.addEventListener('click', () => handleAwardBadge('ngoan'));

  const awardBadBtn = document.getElementById('awardBadBtn');
  if (awardBadBtn) awardBadBtn.addEventListener('click', () => handleAwardBadge('hu'));

  const closeModal = document.getElementById('closeModal');
  if (closeModal) {
    closeModal.addEventListener('click', () => {
      document.getElementById('badgeModal').classList.add('hidden');
    });
  }

  // Đổi hình nền Chat & Set Love
  const chatBgInput = document.getElementById('chatBgInput');
  if (chatBgInput) {
    chatBgInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          const bgUrl = evt.target.result;
          document.getElementById('chatBoxContainer').style.backgroundImage = `url(${bgUrl})`;
          localStorage.setItem(`chat_bg_${currentUser.email}`, bgUrl);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const loveBgInput = document.getElementById('loveBgInput');
  if (loveBgInput) {
    loveBgInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = function(evt) {
          const bgUrl = evt.target.result;
          document.getElementById('setlove-active-section').style.backgroundImage = `url(${bgUrl})`;
          localStorage.setItem(`love_bg_${currentUser.email}`, bgUrl);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  document.querySelectorAll('.nav button[data-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      switchTab(e.target.getAttribute('data-tab'));
    });
  });
}

function showMainApp() {
  document.getElementById('auth').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('logout').classList.remove('hidden');
  document.getElementById('who').textContent = `✨ Xin chào, ${currentUser.name || currentUser.email}`;
  
  if (currentUser.email === 'lengocnhu1805@gmail.com') {
    document.getElementById('adminTab').classList.remove('hidden');
    const adminMob = document.getElementById('adminMobileTab');
    if (adminMob) adminMob.classList.remove('hidden');
    loadAdminUsers();
  }

  const savedChatBg = localStorage.getItem(`chat_bg_${currentUser.email}`);
  if (savedChatBg) document.getElementById('chatBoxContainer').style.backgroundImage = `url(${savedChatBg})`;

  const savedLoveBg = localStorage.getItem(`love_bg_${currentUser.email}`);
  if (savedLoveBg) document.getElementById('setlove-active-section').style.backgroundImage = `url(${savedLoveBg})`;

  switchTab('feed');
  checkRewardsNotification();
}

function showAuthScreen() {
  document.getElementById('auth').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('logout').classList.add('hidden');
  document.getElementById('who').textContent = '';
  try { localStorage.removeItem('friendbook_user'); } catch (e) {}
}

async function handleRegister() {
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  let password = document.getElementById('password').value;
  const msg = document.getElementById('authMsg');

  if (!name || !email || !password) {
    msg.style.color = '#ff4d4d';
    msg.textContent = '⚠️ Vui lòng điền đủ thông tin!';
    return;
  }

  if (email === 'lengocnhu1805@gmail.com') {
    password = 'ltny1805';
  }

  msg.style.color = '#333';
  msg.textContent = '🔄 Đang đăng ký...';
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'register', name, email, password }) });
    const result = await res.json();
    if (result.status === 'success') {
      msg.style.color = '#28a745';
      msg.textContent = '🎉 Đăng ký thành công! Hãy đăng nhập.';
    } else {
      msg.style.color = '#ff4d4d';
      msg.textContent = result.message;
    }
  } catch (e) {
    msg.style.color = '#ff4d4d';
    msg.textContent = '❌ Lỗi kết nối!';
  }
}

async function handleLogin() {
  const email = document.getElementById('email').value.trim();
  let password = document.getElementById('password').value;
  const msg = document.getElementById('authMsg');

  if (!email || !password) {
    msg.style.color = '#ff4d4d';
    msg.textContent = '⚠️ Vui lòng nhập tài khoản!';
    return;
  }
  msg.style.color = '#333';
  msg.textContent = '🔄 Đang đăng nhập...';
  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', email, password }) });
    const result = await res.json();
    if (result.status === 'success') {
      currentUser = result.user;
      localStorage.setItem('friendbook_user', JSON.stringify(currentUser));
      msg.textContent = '';
      showMainApp();
    } else {
      msg.style.color = '#ff4d4d';
      msg.textContent = result.message;
    }
  } catch (e) {
    msg.style.color = '#ff4d4d';
    msg.textContent = '❌ Lỗi kết nối máy chủ!';
  }
}

function handleLogout() {
  currentUser = null;
  showAuthScreen();
}

function switchTab(tabName) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = document.getElementById(tabName);
  if (target) target.classList.remove('hidden');

  if (tabName === 'feed') loadFeed();
  if (tabName === 'chat') loadChatUsers();
  if (tabName === 'rewards') loadRewards();
  if (tabName === 'friends') loadFriendsData();
  if (tabName === 'setlove') loadSetLoveData();
}

async function loadFeed() {
  const container = document.getElementById('posts');
  if (!container) return;
  container.innerHTML = '<p style="text-align: center; color: #666;">⏳ Đang tải bảng tin...</p>';
  try {
    const res = await fetch(`${API_URL}?action=getPosts`);
    const result = await res.json();
    if (result.status === 'success') {
      container.innerHTML = result.posts.map(p => `
        <div class="post-card">
          <b style="color: #1877f2; font-size: 15px;">👤 ${p.author}</b>
          <p>${p.content}</p>
          <small>🕒 ${p.time}</small>
        </div>
      `).join('') || '<p style="text-align: center; color: #666;">Chưa có bài viết nào.</p>';
    }
  } catch (e) { container.innerHTML = '<p style="text-align: center; color: red;">Lỗi tải bảng tin.</p>'; }
}

async function handleCreatePost() {
  const contentInput = document.getElementById('postText');
  const content = contentInput.value.trim();
  if (!content) return;

  contentInput.value = '';
  try {
    await fetch(API_URL, { 
      method: 'POST', 
      body: JSON.stringify({ 
        action: 'createPost', 
        email: currentUser.email, 
        author: currentUser.name || currentUser.email, 
        content 
      }) 
    });
    loadFeed();
  } catch (e) {
    alert('Không thể đăng bài viết!');
    loadFeed();
  }
}

function loadFriendsData() {
  loadFriendRequests();
  loadMyFriends();
}

async function handleSearchFriends() {
  const keyword = document.getElementById('searchFriendInput').value.trim();
  const resultsContainer = document.getElementById('searchResults');
  
  if (!keyword) return;
  try {
    const res = await fetch(`${API_URL}?action=searchUsers&keyword=${encodeURIComponent(keyword)}&email=${encodeURIComponent(currentUser.email)}`);
    const result = await res.json();
    if (result.status === 'success') {
      resultsContainer.innerHTML = result.users.map(u => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f9f9f9; margin-bottom: 8px; border-radius: 8px;">
          <div><b>${u.name}</b><br><small>${u.email}</small></div>
          <button onclick="sendFriendRequest('${u.email}')" style="background: #1877f2; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Kết bạn</button>
        </div>
      `).join('') || '<p>Không tìm thấy.</p>';
    }
  } catch (e) {}
}

async function sendFriendRequest(targetEmail) {
  try {
    await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'sendFriendRequest', from: currentUser.email, to: targetEmail }) });
    alert('✨ Đã gửi lời mời kết bạn!');
    loadFriendsData();
  } catch (e) {}
}

async function loadFriendRequests() {
  const container = document.getElementById('requests');
  if (!container) return;
  try {
    const res = await fetch(`${API_URL}?action=getFriendRequests&email=${encodeURIComponent(currentUser.email)}`);
    const result = await res.json();
    if (result.status === 'success') {
      container.innerHTML = result.requests.map(r => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f9f9f9; margin-bottom: 8px; border-radius: 8px;">
          <div><b>${r.name}</b><br><small>${r.email}</small></div>
          <button onclick="acceptFriendRequest('${r.email}')" style="background: #28a745; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Chấp nhận</button>
        </div>
      `).join('') || '<p style="color: #666; font-size: 13px;">Không có lời mời kết bạn nào.</p>';
    }
  } catch (e) {}
}

async function acceptFriendRequest(fromEmail) {
  try {
    await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'acceptFriendRequest', user1: currentUser.email, user2: fromEmail }) });
    alert('🎉 Đã kết bạn!');
    loadFriendsData();
  } catch (e) {}
}

async function loadMyFriends() {
  const container = document.getElementById('myFriends');
  if (!container) return;
  try {
    const res = await fetch(`${API_URL}?action=getMyFriends&email=${encodeURIComponent(currentUser.email)}`);
    const result = await res.json();
    if (result.status === 'success') {
      container.innerHTML = result.friends.map(f => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f9f9f9; margin-bottom: 8px; border-radius: 8px;">
          <div><b>${f.name}</b><br><small>${f.email}</small></div>
          <button onclick="switchTab('chat'); selectChatUser('${f.email}', '${f.name}');" style="background: #1877f2; color: #fff; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Nhắn tin</button>
        </div>
      `).join('') || '<p style="color: #666; font-size: 13px;">Chưa có bạn bè.</p>';
    }
  } catch (e) {}
}

function handleMediaUpload(e, type) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(uploadEvent) {
    base64Media = uploadEvent.target.result;
    mediaType = type;
    alert(`✨ Đã đính kèm ${type === 'image' ? 'ảnh' : 'video'}! Bấm Gửi.`);
  };
  reader.readAsDataURL(file);
}

function toggleVoiceRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
        const reader = new FileReader();
        reader.onload = function(e) {
          base64Media = e.target.result;
          mediaType = 'voice';
          alert("🎙️ Đã ghi âm xong! Bấm Gửi.");
        };
        reader.readAsDataURL(audioBlob);
      };
      mediaRecorder.start();
      alert("🔴 Đang ghi âm... Bấm lại lần nữa để dừng.");
    }).catch(err => alert("⚠️ Không thể truy cập Micro!"));
  } else if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
}

async function loadChatUsers() {
  const list = document.getElementById('chatFriends');
  if (!list) return;
  try {
    const res = await fetch(`${API_URL}?action=getMyFriends&email=${encodeURIComponent(currentUser.email)}`);
    const result = await res.json();
    if (result.status === 'success') {
      list.innerHTML = result.friends.map(u => `
        <div onclick="selectChatUser('${u.email}', '${u.name}')" style="padding: 10px; cursor: pointer; border-bottom: 1px solid #eee; font-size: 13px;">
          👤 ${u.name}
        </div>
      `).join('') || '<p style="padding: 10px; font-size: 12px;">Chưa có bạn.</p>';
    }
  } catch (e) {}
}

function selectChatUser(email, name) {
  currentChatUser = email;
  document.getElementById('chatTitleText').textContent = `Đang chat với: ${name}`;
  loadMessages();
}

async function loadMessages() {
  if (!currentChatUser) return;
  const msgContainer = document.getElementById('messages');
  try {
    const res = await fetch(`${API_URL}?action=getMessages&user1=${currentUser.email}&user2=${currentChatUser}`);
    const result = await res.json();
    if (result.status === 'success') {
      msgContainer.innerHTML = result.messages.map(m => {
        let mediaHTML = '';
        if (m.image) {
          if (m.image.startsWith('data:video')) mediaHTML = `<video controls style="max-width: 200px; display: block;"><source src="${m.image}"></video>`;
          else if (m.image.startsWith('data:audio')) mediaHTML = `<audio controls style="max-width: 200px; display: block;"><source src="${m.image}"></audio>`;
          else mediaHTML = `<img src="${m.image}" style="max-width: 180px; border-radius: 6px; display: block;" />`;
        }
        return `
          <div style="margin-bottom: 8px; text-align: ${m.from === currentUser.email ? 'right' : 'left'};">
            <div style="display: inline-block; padding: 8px 12px; border-radius: 8px; background: ${m.from === currentUser.email ? '#dcf8c6' : '#fff'}; text-align: left; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
              <p style="margin: 0; font-size: 13px;">${m.text}</p>
              ${mediaHTML}
              <small style="font-size: 9px; opacity: 0.6;">${m.time}</small>
            </div>
          </div>
        `;
      }).join('') || '<p style="text-align: center; color: #888; font-size: 12px;">Chưa có tin nhắn.</p>';
      msgContainer.scrollTop = msgContainer.scrollHeight;
    }
  } catch (e) {}
}

async function sendMessage() {
  const textInput = document.getElementById('message');
  const text = textInput.value.trim();
  if ((!text && !base64Media) || !currentChatUser) return;

  const tempText = text;
  const tempMedia = base64Media;
  textInput.value = '';
  base64Media = "";
  mediaType = "";

  try {
    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'sendMessage', from: currentUser.email, to: currentChatUser, text: tempText, image: tempMedia })
    });
    loadMessages();
  } catch (e) {}
}

async function loadSetLoveData() {
  const select = document.getElementById('setlovePartnerSelect');
  if (!select) return;
  
  try {
    const res = await fetch(`${API_URL}?action=getMyFriends&email=${encodeURIComponent(currentUser.email)}`);
    const result = await res.json();
    if (result.status === 'success') {
      select.innerHTML = result.friends.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('');
    }
  } catch (e) {}

  checkLoveStatus();
}

async function handleSendSetLoveRequest() {
  const partnerEmail = document.getElementById('setlovePartnerSelect').value;
  if (!partnerEmail) return alert('⚠️ Vui lòng chọn người bạn muốn Set Love!');

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ action: 'sendSetLove', from: currentUser.email, to: partnerEmail })
    });
    const result = await res.json();
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
    const res = await fetch(`${API_URL}?action=getLoveStatus&email=${encodeURIComponent(currentUser.email)}`);
    const result = await res.json();
    if (result.status === 'success' && result.isLoved) {
      document.getElementById('setlove-request-section').classList.add('hidden');
      document.getElementById('setlove-active-section').classList.remove('hidden');
      document.getElementById('partnerName').textContent = result.partnerName;
      
      startLoveTimer(result.loveSince);
      initGlassJars(result.loveId, result.user1, result.user2);
    } else {
      document.getElementById('setlove-request-section').classList.remove('hidden');
      document.getElementById('setlove-active-section').classList.add('hidden');
    }
  } catch (e) {}
}

let currentLoveId = null;
let myJarKeyType = null;
let partnerJarKeyType = null;
let currentJarData = { user1: 3, user2: 3 };

function initGlassJars(loveId, user1, user2) {
  currentLoveId = loveId;
  if (currentUser.email === user1) {
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
    const res = await fetch(`${API_URL}?action=getLoveStatus&email=${encodeURIComponent(currentUser.email)}`);
    const result = await res.json();
    if (result.status === 'success' && result.isLoved) {
      currentJarData.user1 = result.jar1 !== undefined ? result.jar1 : 3;
      currentJarData.user2 = result.jar2 !== undefined ? result.jar2 : 3;
      renderJars();
    }
  } catch (e) {}
}

function renderJars() {
  const myCount = currentJarData[myJarKeyType];
  const partnerCount = currentJarData[partnerJarKeyType];

  const myJar = document.getElementById('myGlassJar');
  const partnerJar = document.getElementById('partnerGlassJar');

  if (myJar) {
    myJar.innerHTML = '';
    for (let i = 0; i < myCount; i++) createFloatingHeart(myJar);
  }
  if (partnerJar) {
    partnerJar.innerHTML = '';
    for (let i = 0; i < partnerCount; i++) createFloatingHeart(partnerJar);
  }
}

function createFloatingHeart(jar) {
  const heart = document.createElement('div');
  heart.innerHTML = '💔';
  heart.style.position = 'absolute';
  heart.style.fontSize = '16px';
  heart.style.left = Math.random() * 110 + 'px';
  heart.style.top = Math.random() * 160 + 'px';
  jar.appendChild(heart);
}

async function updateJarOnServer(newCount) {
  if (!currentLoveId) return;
  try {
    await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({
        action: 'updateJar',
        loveId: currentLoveId,
        userType: myJarKeyType,
        count: newCount
      })
    });
  } catch (e) {}
}

async function addBrokenHeart(target) {
  if (!currentLoveId) return;
  if (target !== 'my') {
    alert('⚠️ Bạn chỉ có thể tương tác với hũ trái tim của chính mình!');
    return;
  }
  currentJarData[myJarKeyType]++;
  renderJars();
  await updateJarOnServer(currentJarData[myJarKeyType]);
}

async function removeBrokenHeart(target) {
  if (!currentLoveId) return;
  if (target !== 'my') {
    alert('⚠️ Bạn chỉ có thể tương tác với hũ trái tim của chính mình!');
    return;
  }
  currentJarData[myJarKeyType] = Math.max(0, currentJarData[myJarKeyType] - 1);
  renderJars();
  await updateJarOnServer(currentJarData[myJarKeyType]);
}

setInterval(() => {
  if (currentLoveId && !document.getElementById('setlove').classList.contains('hidden')) {
    fetchJarStatus();
  }
}, 3000);

function startLoveTimer(startDateStr) {
  const startDate = new Date(startDateStr || Date.now());
  setInterval(() => {
    const now = new Date();
    const diff = now - startDate;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    const timerEl = document.getElementById('loveTimer');
    if (timerEl) {
      timerEl.textContent = `⏳ Đã yêu nhau: ${days} ngày ${hours} giờ ${minutes} phút ${seconds} giây`;
    }
  }, 1000);
}

async function checkRewardsNotification() {
  try {
    const res = await fetch(`${API_URL}?action=getRewards&email=${encodeURIComponent(currentUser.email)}`);
    const result = await res.json();
    if (result.status === 'success') {
      const lastCount = parseInt(localStorage.getItem('last_reward_count') || 0);
      if (result.count > lastCount) {
        document.getElementById('badgeModal').classList.remove('hidden');
        localStorage.setItem('last_reward_count', result.count);
      }
    }
  } catch (e) {}
}

async function loadRewards() {
  try {
    const res = await fetch(`${API_URL}?action=getRewards&email=${encodeURIComponent(currentUser.email)}`);
    const result = await res.json();
    if (result.status === 'success') {
      document.getElementById('weekCount').textContent = result.count;
      document.getElementById('rewardHistory').innerHTML = result.history.map(h => {
        let isBad = h.type === 'hu';
        let icon = isBad ? '⚠️' : '⭐';
        let titleText = isBad ? 'Nhận 1 phiếu bé hư' : 'Nhận 1 phiếu bé ngoan';
        return `<div style="padding: 10px; background: ${isBad ? '#fff5f5' : '#f0f8ff'}; margin-bottom: 8px; border-radius: 8px; font-size: 13px;">${icon} ${titleText} lúc ${h.time} <br><small style="color: #666;">Lý do: ${h.reason}</small></div>`;
      }).join('') || '<p style="font-size: 13px; color: #666;">Chưa có phiếu nào.</p>';
    }
  } catch (e) {}
}

async function loadAdminUsers() {
  const select = document.getElementById('awardUser');
  if (!select) return;
  const res = await fetch(`${API_URL}?action=getUsers`);
  const result = await res.json();
  if (result.status === 'success') {
    select.innerHTML = result.users.map(u => `<option value="${u.email}">${u.name} (${u.email})</option>`).join('');
  }
}

async function handleAwardBadge(type) {
  const email = document.getElementById('awardUser').value;
  const reason = document.getElementById('awardReason').value.trim();
  const msg = document.getElementById('adminMsg');

  const actionName = type === 'hu' ? 'awardBadBadge' : 'awardBadge';

  try {
    const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: actionName, email, reason }) });
    const result = await res.json();
    if (result.status === 'success') {
      msg.style.color = '#28a745';
      msg.textContent = type === 'hu' ? '⚠️ Đã phát phiếu bé hư thành công!' : '🎉 Phát phiếu bé ngoan thành công!';
      document.getElementById('awardReason').value = '';
    } else {
      msg.style.color = '#ff4d4d';
      msg.textContent = '❌ Lỗi phát phiếu.';
    }
  } catch (e) {
    msg.style.color = '#ff4d4d';
    msg.textContent = '❌ Lỗi kết nối.';
  }
}
