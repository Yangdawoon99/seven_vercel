export const AuthState = {
    step: 'global', // global, member
    globalCode: 'senafinal0522',
    selectedMember: null,
    tempPin: null, // For first time setup confirmation
    currentUser: null
};

// Helper to check if logged in
export function isLoggedIn() {
    return !!AuthState.currentUser;
}

// Helper to get current user ID
export function getCurrentUserId() {
    return AuthState.currentUser ? AuthState.currentUser.id : null;
}
