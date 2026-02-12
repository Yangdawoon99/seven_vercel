const API_URL = '/api';

export const ApiService = {
    // Heroes
    async getHeroes() {
        const response = await fetch(`${API_URL}/heroes`);
        return await response.json();
    },
    async saveHero(hero) {
        const response = await fetch(`${API_URL}/heroes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(hero)
        });
        return await response.json();
    },
    async deleteHero(id) {
        const response = await fetch(`${API_URL}/heroes/${id}`, {
            method: 'DELETE'
        });
        return await response.json();
    },

    // Equipment
    async getEquipment() {
        const response = await fetch(`${API_URL}/equipment`);
        return await response.json();
    },
    async saveEquipment(equip) {
        const response = await fetch(`${API_URL}/equipment`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(equip)
        });
        return await response.json();
    },
    async deleteEquipment(id) {
        const response = await fetch(`${API_URL}/equipment/${id}`, {
            method: 'DELETE'
        });
        return await response.json();
    },

    // Presets
    async getPresets() {
        const response = await fetch(`${API_URL}/presets`);
        return await response.json();
    },
    async savePreset(preset) {
        const response = await fetch(`${API_URL}/presets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(preset)
        });
        return await response.json();
    },
    async deletePreset(id) {
        const response = await fetch(`${API_URL}/presets/${id}`, {
            method: 'DELETE'
        });
        return await response.json();
    }
};
