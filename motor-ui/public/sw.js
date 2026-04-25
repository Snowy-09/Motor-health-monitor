// This script runs in the background and listens for push alerts from your Python backend
self.addEventListener('push', function(event) {
    const data = event.data.json();
    
    const options = {
        body: data.body,
        icon: '/favicon.svg', // Using your existing SVG icon
        vibrate: [500, 200, 500, 200, 500], // Makes Android phones vibrate aggressively
        requireInteraction: true // Keeps the notification on screen until the user clicks it
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// This handles what happens when the user clicks the notification
self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(windowClients => {
            // If the dashboard is already open, focus on it
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url === '/' && 'focus' in client) {
                    return client.focus();
                }
            }
            // If it's closed, open a new window to the dashboard
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});