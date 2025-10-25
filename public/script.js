function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
}

function toggleTheme() {
    const currentTheme = localStorage.getItem('theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

const savedTheme = localStorage.getItem('theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
if (savedTheme) {
    setTheme(savedTheme);
} else if (prefersDark) {
    setTheme('dark');
} else {
    setTheme('light');
}

document.addEventListener('DOMContentLoaded', () => {
    const imageModal = document.getElementById('image-modal');
    const imageModalContent = document.getElementById('image-modal-content');
    const imageModalCloseBtn = document.getElementById('image-modal-close-btn');

    if (imageModal && imageModalContent && imageModalCloseBtn) {

        const openImageModal = (imgSrc) => {
            imageModalContent.src = imgSrc; 
            imageModal.style.display = 'flex'; 
        };

        const closeImageModal = () => {
            imageModal.style.display = 'none';
            imageModalContent.src = "";
        };

        const profilePicBtn = document.getElementById('profile-pic-btn');
        if (profilePicBtn) {
            profilePicBtn.style.cursor = 'pointer';
            profilePicBtn.addEventListener('click', () => {
                openImageModal(profilePicBtn.src);
            });
        }

        const projectImages = document.querySelectorAll('.project-modal-trigger');
        projectImages.forEach(img => {
            img.style.cursor = 'pointer';
            img.addEventListener('click', () => {
                openImageModal(img.src);
            });
        });
        imageModalCloseBtn.addEventListener('click', closeImageModal);
        imageModal.addEventListener('click', (e) => {
            if (e.target === imageModal) {
                closeImageModal();
            }
        });
    }

});