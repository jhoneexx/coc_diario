// Utilitário para inicializar tema e configurações visuais
export const initTheme = () => {
  // Definir o tema do documento
  document.title = 'Diário de Bordo - Cloud Operations Center';
  
  // Definir favicon se não existir
  if (!document.querySelector('link[rel="icon"]')) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%232563EB"><path d="M2 15a7 7 0 1 1 14 0 7 7 0 0 1-14 0Z" opacity=".5" /><path d="M16 6a2 2 0 0 1 2 2v7.341A7.033 7.033 0 0 1 17.736 15H16V6Z" opacity=".3" /><path d="M7 21a3 3 0 0 1-3-3h2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1h2a3 3 0 0 1-3 3H7ZM17.5 3a4.5 4.5 0 1 1 0 9 5.532 5.532 0 0 0-1.5-.211V7.5A4.5 4.5 0 0 0 17.5 3Z" /></svg>';
    document.head.appendChild(link);
  }
  
  // Verificar se há uma preferência de tema no localStorage
  const savedTheme = localStorage.getItem('theme');
  
  if (savedTheme) {
    document.documentElement.classList.add(savedTheme);
  } else {
    // Se não houver preferência salva, usar a preferência do sistema
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      localStorage.setItem('theme', 'light');
    }
  }
  
  // Adicionar evento para mudança de preferência do sistema
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    const newTheme = e.matches ? 'dark' : 'light';
    localStorage.setItem('theme', newTheme);
    
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    }
  });
};