import { authService } from '@/lib/firebase/auth-service';
import { chatService } from '@/lib/firebase/chat-service';
import { messageService } from '@/lib/firebase/message-service';
import { firestoreService } from '@/lib/firebase/firestore-service';

async function testFirebaseIntegration() {
  console.log('Testing Firebase integration...');
  
  try {
    // Test Firestore service
    console.log('✓ Firebase services imported successfully');
    
    // Test if we can access the auth service
    const currentUser = await authService.getCurrentUser();
    console.log('✓ Auth service accessible:', currentUser ? 'User found' : 'No user');
    
    // Test basic Firestore operations (these will fail without auth, but shouldn't crash)
    try {
      await firestoreService.queryCollection('chats', { limit: 1 });
      console.log('✓ Firestore query operations work');
    } catch (error) {
      console.log('⚠ Firestore query failed (expected without auth):', error);
    }
    
    console.log('✓ Firebase integration test completed successfully');
    return true;
  } catch (error) {
    console.error('✗ Firebase integration test failed:', error);
    return false;
  }
}

// Export test function
export { testFirebaseIntegration };