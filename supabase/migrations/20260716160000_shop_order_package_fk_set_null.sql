-- Historical shop orders must not block editing/removing catalog packages. The package FKs
-- were created with the default NO ACTION, which blocks deleting a package once it has been
-- ordered. Switch them to ON DELETE SET NULL (orders already snapshot their own totals).

ALTER TABLE public.shop_checkout_orders
  DROP CONSTRAINT IF EXISTS shop_checkout_orders_selected_package_id_fkey;
ALTER TABLE public.shop_checkout_orders
  ADD CONSTRAINT shop_checkout_orders_selected_package_id_fkey
    FOREIGN KEY (selected_package_id) REFERENCES public.packages(id) ON DELETE SET NULL;

ALTER TABLE public.shop_checkout_order_items
  DROP CONSTRAINT IF EXISTS shop_checkout_order_items_package_id_fkey;
ALTER TABLE public.shop_checkout_order_items
  ADD CONSTRAINT shop_checkout_order_items_package_id_fkey
    FOREIGN KEY (package_id) REFERENCES public.packages(id) ON DELETE SET NULL;
