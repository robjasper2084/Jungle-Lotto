(() => {
 if(window.parent!==window)return;
 const link=document.createElement('a');link.href='../../#underground-rewards';link.textContent='← ALL GAMES / STORE';link.style.cssText='position:fixed;top:8px;left:12px;z-index:100;font:9px monospace;letter-spacing:1px;color:#efd299;background:#080b13d9;border:1px solid #c9b07d66;border-radius:4px;padding:9px 12px;text-decoration:none';document.body.append(link);
 const sync=()=>{link.hidden=!document.body.classList.contains('is-title-mode');};new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});sync();
})();
