export const isTokenExpired = (token: string): boolean => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (!payload.exp) return false;
        const expirationDate = payload.exp * 1000;
        return Date.now() >= expirationDate;
    } catch {
        return true;
    }
};

export const getTokenExpirationTime = (token: string): number | null => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.exp ? payload.exp * 1000 : null;
    } catch {
        return null;
    }
};
