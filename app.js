document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');
    const form = document.getElementById('lineup-form');
    const jsonEditor = document.getElementById('json-editor');
    const saveJsonBtn = document.getElementById('save-json-btn');
    const statusMsg = document.getElementById('status-message');
    const jsonStatusMsg = document.getElementById('json-status-message');
    const visualList = document.getElementById('visual-list');

    // Global preference for units: 'ticks' or 'ms'
    let currentUnit = 'ticks';
    const TICK_MS_CONVERSION = 15.625;

    // Tab Switching
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));
            
            tab.classList.add('active');
            const target = tab.getAttribute('data-tab');
            document.querySelector(`.tab-content[data-content="${target}"]`).classList.add('active');

            if (target === 'view' || target === 'list') {
                loadJSON();
            }
        });
    });

    // Form Submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const rawTicksVal = parseInt(document.getElementById('movement_ticks').value) || 0;
        const finalTicksVal = currentUnit === 'ms' ? Math.round(rawTicksVal / TICK_MS_CONVERSION) : rawTicksVal;

        const payload = {
            map: document.getElementById('map').value,
            grenade_type: document.getElementById('grenade_type').value,
            title: document.getElementById('title').value,
            description: document.getElementById('description').value,
            movement: {
                throwtype: document.getElementById('movement_throwtype').value,
                modifiers: Array.from(document.querySelectorAll('.movement-modifier:checked')).map(el => el.value),
                movement_key: document.getElementById('movement_key').value || null,
                movement_ticks: finalTicksVal,
                jump: document.getElementById('movement_jump').checked
            },
            view_angle: {
                x: parseFloat(document.getElementById('view_angle_x').value),
                y: parseFloat(document.getElementById('view_angle_y').value)
            },
            position: {
                x: parseFloat(document.getElementById('pos_x').value),
                y: parseFloat(document.getElementById('pos_y').value),
                z: parseFloat(document.getElementById('pos_z').value)
            }
        };

        try {
            const res = await fetch('?action=save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (res.ok) {
                showStatus(statusMsg, 'Lineup saved successfully!', 'success');
                form.reset();
            } else {
                showStatus(statusMsg, 'Failed to save lineup.', 'error');
            }
        } catch (err) {
            showStatus(statusMsg, 'Network error. Make sure server is running.', 'error');
        }
    });

    // Load JSON
    async function loadJSON() {
        try {
            const res = await fetch('?action=load');
            const data = await res.json();
            jsonEditor.value = JSON.stringify(data, null, 4);
            renderVisualList(data);
        } catch (err) {
            jsonEditor.value = '{\n    "error": "Could not connect to server"\n}';
        }
    }

    // Save edited JSON
    saveJsonBtn.addEventListener('click', async () => {
        try {
            const parsed = JSON.parse(jsonEditor.value);
            const res = await fetch('?action=save_raw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed)
            });
            
            if (res.ok) {
                showStatus(jsonStatusMsg, 'JSON updated successfully!', 'success');
                renderVisualList(parsed);
            } else {
                showStatus(jsonStatusMsg, 'Failed to update JSON.', 'error');
            }
        } catch (err) {
            showStatus(jsonStatusMsg, 'Invalid JSON format!', 'error');
        }
    });

    function renderVisualList(data) {
        visualList.innerHTML = '';
        if (Object.keys(data).length === 0) {
            visualList.innerHTML = '<p style="color:var(--text-muted); text-align:center; padding: 20px;">No lineups found.</p>';
            return;
        }

        for (const [mapName, nades] of Object.entries(data)) {
            const mapSection = document.createElement('div');
            mapSection.className = 'map-category';
            
            const title = document.createElement('h3');
            title.className = 'map-title';
            title.textContent = mapName.toUpperCase();
            mapSection.appendChild(title);

            nades.forEach(nade => {
                const card = document.createElement('div');
                card.className = 'nade-card';
                card.innerHTML = `
                    <div class="nade-header">
                        <div class="nade-title">${nade.title}</div>
                        <div class="nade-type">${nade.grenade_type.replace('_', ' ').toUpperCase()}</div>
                    </div>
                    <div class="nade-desc">${nade.description}</div>
                    <div class="nade-details">
                        <div class="detail-item">Movement: <span>${getMovementLabel(nade.movement)}</span></div>
                        <div class="detail-item">Angles: <span>${nade.view_angle ? nade.view_angle.x : 0}, ${nade.view_angle ? nade.view_angle.y : 0}</span></div>
                        <div class="detail-item" style="grid-column: span 2">Pos: <span>${nade.position ? nade.position.x : 0}, ${nade.position ? nade.position.y : 0}, ${nade.position ? nade.position.z : 0}</span></div>
                    </div>
                `;
                mapSection.appendChild(card);
            });

            visualList.appendChild(mapSection);
        }
    }

    function getMovementLabel(movement) {
        if (!movement) return 'NONE';
        let parts = [];
        if (movement.throwtype && movement.throwtype !== 'none') {
            parts.push(movement.throwtype.toUpperCase() + ' CLICK');
        }
        if (movement.modifiers && movement.modifiers.length > 0) {
            movement.modifiers.forEach(mod => parts.push(mod.toUpperCase()));
        }
        if (movement.movement_key) {
            parts.push(movement.movement_key.toUpperCase() + ` (${movement.movement_ticks || 0} ticks)`);
        }
        if (movement.jump) {
            parts.push('JUMP');
        }
        return parts.length > 0 ? parts.join(' + ') : 'MANUAL';
    }

    function showStatus(elem, msg, type) {
        elem.textContent = msg;
        elem.className = type;
        setTimeout(() => { elem.textContent = ''; elem.className = ''; }, 3000);
    }

    // Get current localplayer data
    const getDataBtn = document.getElementById('get-data-btn');
    if (getDataBtn) {
        getDataBtn.addEventListener('click', async () => {
            try {
                const res = await fetch('?action=get_player_data');
                if (res.ok) {
                    const data = await res.json();
                    
                    if (data.map) document.getElementById('map').value = data.map;
                    if (data.weapon) {
                        const sel = document.getElementById('grenade_type');
                        const matchingOpt = Array.from(sel.options).find(opt => opt.value === data.weapon);
                        if (matchingOpt) matchingOpt.selected = true;
                    }
                    if (data.angles) {
                        document.getElementById('view_angle_x').value = data.angles.x;
                        document.getElementById('view_angle_y').value = data.angles.y;
                    }
                    if (data.position) {
                        document.getElementById('pos_x').value = data.position.x;
                        document.getElementById('pos_y').value = data.position.y;
                        document.getElementById('pos_z').value = data.position.z;
                    }

                    showStatus(statusMsg, 'Retrieved player data!', 'success');
                } else {
                    showStatus(statusMsg, 'Make sure you are in-game.', 'error');
                }
            } catch (err) {
                showStatus(statusMsg, 'Failed to connect to FC2!', 'error');
            }
        });
    }

    // Make crouch and shift mutually exclusive in the creation form
    const crouchCheckbox = document.querySelector('.movement-modifier[value="crouch"]');
    const shiftCheckbox = document.querySelector('.movement-modifier[value="shift"]');
    if (crouchCheckbox && shiftCheckbox) {
        crouchCheckbox.addEventListener('change', () => {
            if (crouchCheckbox.checked) {
                shiftCheckbox.checked = false;
            }
        });
        shiftCheckbox.addEventListener('change', () => {
            if (shiftCheckbox.checked) {
                crouchCheckbox.checked = false;
            }
        });
    }

    function setUnit(unit) {
        if (currentUnit === unit) return;
        
        const oldUnit = currentUnit;
        currentUnit = unit;

        // Update UI toggles to active state
        document.querySelectorAll('.unit-toggle').forEach(toggle => {
            toggle.querySelectorAll('.unit-btn').forEach(btn => {
                if (btn.dataset.unit === unit) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
        });

        // Update input values and step sizes
        const creationInput = document.getElementById('movement_ticks');
        const editInput = document.getElementById('edit_movement_ticks');

        if (creationInput) {
            let val = parseInt(creationInput.value) || 0;
            if (unit === 'ms' && oldUnit === 'ticks') {
                creationInput.value = Math.round(val * TICK_MS_CONVERSION);
                creationInput.setAttribute('step', '16');
            } else if (unit === 'ticks' && oldUnit === 'ms') {
                creationInput.value = Math.round(val / TICK_MS_CONVERSION);
                creationInput.setAttribute('step', '1');
            }
        }

        if (editInput) {
            let val = parseInt(editInput.value) || 0;
            if (unit === 'ms' && oldUnit === 'ticks') {
                editInput.value = Math.round(val * TICK_MS_CONVERSION);
                editInput.setAttribute('step', '16');
            } else if (unit === 'ticks' && oldUnit === 'ms') {
                editInput.value = Math.round(val / TICK_MS_CONVERSION);
                editInput.setAttribute('step', '1');
            }
        }
    }

    // Bind click events on all unit toggle elements
    document.querySelectorAll('.unit-toggle').forEach(toggle => {
        toggle.querySelectorAll('.unit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                setUnit(btn.dataset.unit);
            });
        });
    });
});
