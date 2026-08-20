// Mock Data for Candidates
const mockCandidates = [
    {
        id: 'c1',
        name: 'Sarah Jenkins',
        role: 'Senior Frontend Engineer',
        status: 'applied',
        match: 'High',
        appliedDate: '2d ago'
    },
    {
        id: 'c2',
        name: 'Michael Chang',
        role: 'Backend Developer',
        status: 'applied',
        match: 'Medium',
        appliedDate: '3d ago'
    },
    {
        id: 'c3',
        name: 'Elena Rodriguez',
        role: 'UX Designer',
        status: 'applied',
        match: 'High',
        appliedDate: '5d ago'
    },
    {
        id: 'c4',
        name: 'David Kim',
        role: 'Product Manager',
        status: 'screening',
        match: 'High',
        appliedDate: '1w ago'
    },
    {
        id: 'c5',
        name: 'Jessica Taylor',
        role: 'Data Analyst',
        status: 'screening',
        match: 'Low',
        appliedDate: '1w ago'
    },
    {
        id: 'c6',
        name: 'Robert Chen',
        role: 'DevOps Engineer',
        status: 'interviewing',
        match: 'High',
        appliedDate: '2w ago'
    },
    {
        id: 'c7',
        name: 'Emily Davis',
        role: 'Marketing Director',
        status: 'offer',
        match: 'High',
        appliedDate: '3w ago'
    }
];

document.addEventListener('DOMContentLoaded', () => {
    initThemeToggle();
    initSidebarPills();
    renderKanbanBoard();
    setupDragAndDrop();
});

function initThemeToggle() {
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (!themeToggleBtn) return;
    
    const icon = themeToggleBtn.querySelector('i');
    
    // Check saved preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    }
    
    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark-theme');
        
        if (document.body.classList.contains('dark-theme')) {
            localStorage.setItem('theme', 'dark');
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            localStorage.setItem('theme', 'light');
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    });
}

function initSidebarPills() {
    const pills = document.querySelectorAll('.pill-nav .pill');
    const ease = 'power3.easeOut';

    pills.forEach(pill => {
        const circle = pill.querySelector('.hover-circle');
        const label = pill.querySelector('.pill-label');
        const white = pill.querySelector('.pill-label-hover');

        if (!circle || !label || !white) return;

        // Use setTimeout to ensure DOM is fully laid out
        setTimeout(() => {
            const rect = pill.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height || 44; 
            const R = ((w * w) / 4 + h * h) / (2 * h);
            const D = Math.ceil(2 * R) + 2;
            const delta = Math.ceil(R - Math.sqrt(Math.max(0, R * R - (w * w) / 4))) + 1;
            const originY = D - delta;

            circle.style.width = `${D}px`;
            circle.style.height = `${D}px`;
            circle.style.bottom = `-${delta}px`;

            gsap.set(circle, {
                xPercent: -50,
                scale: 0,
                transformOrigin: `50% ${originY}px`
            });

            gsap.set(label, { y: 0 });
            gsap.set(white, { y: h + 12, opacity: 0 });

            const tl = gsap.timeline({ paused: true });

            tl.to(circle, { scale: 1.2, xPercent: -50, duration: 2, ease, overwrite: 'auto' }, 0);
            tl.to(label, { y: -(h + 8), duration: 2, ease, overwrite: 'auto' }, 0);
            
            gsap.set(white, { y: Math.ceil(h + 100), opacity: 0 });
            tl.to(white, { y: 0, opacity: 1, duration: 2, ease, overwrite: 'auto' }, 0);

            pill._tl = tl; // Store timeline

            pill.addEventListener('mouseenter', () => {
                if (pill.classList.contains('is-active')) return;
                if (pill.animationTween) pill.animationTween.kill();
                pill.animationTween = tl.tweenTo(tl.duration(), {
                    duration: 0.3,
                    ease,
                    overwrite: 'auto'
                });
            });

            pill.addEventListener('mouseleave', () => {
                if (pill.classList.contains('is-active')) return;
                if (pill.animationTween) pill.animationTween.kill();
                pill.animationTween = tl.tweenTo(0, {
                    duration: 0.2,
                    ease,
                    overwrite: 'auto'
                });
            });

            pill.addEventListener('click', (e) => {
                e.preventDefault();
                pills.forEach(p => {
                    p.classList.remove('is-active');
                    if (p.animationTween) p.animationTween.kill();
                    if (p._tl) p._tl.tweenTo(0, { duration: 0.2, ease }); // Reverse animation on others
                });
                pill.classList.add('is-active');
                if (pill.animationTween) pill.animationTween.kill();
                tl.tweenTo(tl.duration(), { duration: 0.3, ease }); // Force active state animation
            });
        }, 100);
    });
}

function renderKanbanBoard() {
    // Clear all columns
    document.querySelectorAll('.column-body').forEach(col => col.innerHTML = '');

    // Render cards
    mockCandidates.forEach(candidate => {
        const cardHtml = `
            <div class="candidate-card" draggable="true" data-id="${candidate.id}">
                <div class="card-header">
                    <div>
                        <div class="candidate-name">${candidate.name}</div>
                        <div class="candidate-role">${candidate.role}</div>
                    </div>
                    <div class="dropdown">
                        <i class="fa-solid fa-ellipsis-vertical" style="color: var(--text-muted); cursor: pointer;"></i>
                    </div>
                </div>
                <div class="card-tags">
                    <span class="tag ${candidate.match === 'High' ? 'high-match' : ''}">
                        ${candidate.match} Match
                    </span>
                </div>
                <div class="card-footer">
                    <span><i class="fa-regular fa-clock"></i> ${candidate.appliedDate}</span>
                    <div class="card-actions">
                        <i class="fa-solid fa-envelope" title="Email Candidate"></i>
                        <i class="fa-solid fa-file-pdf" title="View Resume"></i>
                    </div>
                </div>
            </div>
        `;
        
        const column = document.getElementById(`col-${candidate.status}`);
        if (column) {
            column.insertAdjacentHTML('beforeend', cardHtml);
        }
    });

    // Update counts
    updateCounts();
}

function updateCounts() {
    document.querySelectorAll('.kanban-column').forEach(column => {
        const body = column.querySelector('.column-body');
        const countSpan = column.querySelector('.count');
        const count = body.querySelectorAll('.candidate-card').length;
        countSpan.textContent = count;
    });
}

// Basic Drag and Drop
function setupDragAndDrop() {
    let draggedCard = null;

    document.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('candidate-card')) {
            draggedCard = e.target;
            e.target.style.opacity = '0.5';
        }
    });

    document.addEventListener('dragend', (e) => {
        if (e.target.classList.contains('candidate-card')) {
            e.target.style.opacity = '1';
            draggedCard = null;
        }
    });

    document.querySelectorAll('.column-body').forEach(column => {
        column.addEventListener('dragover', (e) => {
            e.preventDefault();
            column.style.background = 'rgba(255, 255, 255, 0.05)';
        });

        column.addEventListener('dragleave', (e) => {
            column.style.background = 'transparent';
        });

        column.addEventListener('drop', (e) => {
            e.preventDefault();
            column.style.background = 'transparent';
            if (draggedCard) {
                column.appendChild(draggedCard);
                // Update candidate status in data
                const cardId = draggedCard.getAttribute('data-id');
                const newStatus = column.getAttribute('data-status');
                const candidate = mockCandidates.find(c => c.id === cardId);
                if (candidate) {
                    candidate.status = newStatus;
                    // In a real app, we would call AWS service here to update DB
                    console.log(`Updated ${candidate.name} to ${newStatus}`);
                }
                updateCounts();
            }
        });
    });
}
