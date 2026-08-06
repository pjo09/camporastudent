 /* ================= ENTRY POPUP + CONFETTI ================= */
  var popup = document.getElementById('entryPopup');
  var popupShown = false;
  var popupTimer = null;
  function showEntryPopup(){
    if(popupShown) return;
    if(funnel.classList.contains('show')) return; // wait politely if the funnel is open
    popupShown = true;
    popup.classList.add('show');
    popup.setAttribute('aria-hidden','false');
  }
  function hideEntryPopup(){
    popup.classList.remove('show');
    popup.setAttribute('aria-hidden','true');
  }
  document.getElementById('popupClose').addEventListener('click', hideEntryPopup);
  popup.addEventListener('click', function(e){ if(e.target === popup) hideEntryPopup(); });

  function fireConfetti(){
    if(reduced) return;
    var canvas = document.getElementById('confettiCanvas');
    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    var colors = ['#2068ff','#5aa8ff','#2fe0d8','#9df4ef','#eef5ff'];
    var pieces = [];
    for(var i=0;i<140;i++){
      pieces.push({
        x: canvas.width/2 + (Math.random()-0.5)*220,
        y: canvas.height*0.4 + (Math.random()-0.5)*60,
        vx: (Math.random()-0.5)*9,
        vy: -(Math.random()*9+4),
        size: Math.random()*7+4,
        color: colors[Math.floor(Math.random()*colors.length)],
        rot: Math.random()*360,
        vrot: (Math.random()-0.5)*14,
        life: 0
      });
    }
    var start = null;
    function frame(ts){
      if(!start) start = ts;
      var elapsed = ts - start;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      pieces.forEach(function(p){
        p.vy += 0.22;
        p.x += p.vx; p.y += p.vy; p.rot += p.vrot;
        ctx.save();
        ctx.translate(p.x,p.y);
        ctx.rotate(p.rot*Math.PI/180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, 1 - elapsed/1800);
        ctx.fillRect(-p.size/2,-p.size/3,p.size,p.size*0.66);
        ctx.restore();
      });
      if(elapsed < 1800){ requestAnimationFrame(frame); }
      else { ctx.clearRect(0,0,canvas.width,canvas.height); }
    }
    requestAnimationFrame(frame);
  }

  document.getElementById('popupForm').addEventListener('submit', function(e){
    e.preventDefault();
    var btn = document.getElementById('popupSubmit');
    fireConfetti();
    btn.classList.remove('btn-glitch');
    btn.classList.add('btn-flat');
    btn.disabled = true;
    btn.querySelector('.label').textContent = "You're in! 🎉";
    setTimeout(hideEntryPopup, 2000);
  });