/** Route paths. Page paths mirror the legacy MVC URLs (controller/action) so CloudMenu links stay valid. */
export const PATHS = {
  login: '/login',
  authCallback: '/auth/callback',
  home: '/Home/Index',
  fieldCaptions: '/Reference/FieldCaptions',
  confirmArrival: '/Data/ConfirmArrival',
} as const;
