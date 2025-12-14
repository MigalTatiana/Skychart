const { testPool } = require('./setup');

module.exports = async () => {
    await testPool.query('DELETE FROM messages');
    await testPool.query('DELETE FROM chats');
    await testPool.query('DELETE FROM favorite_chats');
    await testPool.query('DELETE FROM skychart_points');
    await testPool.query('DELETE FROM skycharts');
    await testPool.query('DELETE FROM users');
    
    await testPool.end();
};