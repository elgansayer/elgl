import { Routes } from '@angular/router';

export const commerceRoutes: Routes = [
  {
    path: 'subscription',
    loadComponent: () =>
      import('../pages/subscription/subscription-page.component').then(
        (m) => m.SubscriptionPageComponent,
      ),
    title: 'Subscription Plans - HelloTalk',
  },
  {
    path: 'subscription/success',
    loadComponent: () =>
      import('../components/subscription-success/subscription-success.component').then(
        (m) => m.SubscriptionSuccessComponent,
      ),
    title: 'Subscription Successful - HelloTalk',
  },
  {
    path: 'subscription/cancel',
    loadComponent: () =>
      import('../components/subscription-cancel/subscription-cancel.component').then(
        (m) => m.SubscriptionCancelComponent,
      ),
    title: 'Subscription Cancelled - HelloTalk',
  },
  {
    path: 'settings/subscription',
    loadComponent: () =>
      import('../pages/my-subscription/my-subscription.component').then(
        (m) => m.MySubscriptionComponent,
      ),
    title: 'My Subscription - HelloTalk',
  },
  {
    path: 'coins/success',
    loadComponent: () =>
      import('../components/coins-success/coins-success.component').then(
        (m) => m.CoinsSuccessComponent,
      ),
    title: 'Coin Purchase - HelloTalk',
  },
  {
    path: 'coins/cancel',
    loadComponent: () =>
      import('../components/coins-cancel/coins-cancel.component').then(
        (m) => m.CoinsCancelComponent,
      ),
    title: 'Coin Purchase Cancelled - HelloTalk',
  },
  {
    path: 'coin-economy',
    loadComponent: () =>
      import('../components/coin-economy-dashboard/coin-economy-dashboard.component').then(
        (m) => m.CoinEconomyDashboardComponent,
      ),
    title: 'Virtual Coin Economy - HelloTalk',
  },
  {
    path: 'shop',
    loadComponent: () => import('../components/shop/shop.component').then((m) => m.ShopComponent),
    title: 'Shop - HelloTalk',
  },
  {
    path: 'sticker-store',
    loadComponent: () =>
      import('../components/sticker-store/sticker-store.component').then(
        (m) => m.StickerStoreComponent,
      ),
    title: 'Sticker Store - HelloTalk',
  },
  {
    path: 'cart',
    loadComponent: () => import('../components/cart/cart.component').then((m) => m.CartComponent),
    title: 'Shopping Cart - HelloTalk',
  },
  {
    path: 'escrow',
    loadComponent: () => import('../pages/escrow/escrow.component').then((m) => m.EscrowComponent),
    title: 'Escrow Payments - HelloTalk',
  },
  {
    path: 'escrow/:id',
    loadComponent: () =>
      import('../pages/escrow-detail/escrow-detail.component').then((m) => m.EscrowDetailComponent),
    title: 'Escrow Details - HelloTalk',
  },
];
