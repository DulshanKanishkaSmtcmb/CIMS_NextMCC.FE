/** Route paths. Page paths mirror the legacy MVC URLs (controller/action) so CloudMenu links stay valid. */
export const PATHS = {
  login: '/login',
  /** The legacy sign-in path, flipped to the SPA for everyone. Legacy pages redirect here with ?ReturnUrl=. */
  legacyLogin: '/Account/Login',
  authCallback: '/auth/callback',
  home: '/Home/Index',
  fieldCaptions: '/Reference/FieldCaptions',
  confirmArrival: '/Data/ConfirmArrival',
  country: '/File/Country',
  ports: '/File/Ports',
  dc: '/File/DC',
  pmMaster: '/File/PMMaster',
  productCategory: '/File/ProductCategory',
} as const;
