export type AccountType = 'worker' | 'business';
export function accountHome(type: AccountType | null, admin = false) {
  return admin ? '/admin' : type === 'business' ? '/business' : type === 'worker' ? '/earn' : '/onboarding';
}
export function canUseFront(type: AccountType | null, admin: boolean, front: AccountType | 'admin') {
  return front === 'admin' ? admin : admin || type === front;
}
