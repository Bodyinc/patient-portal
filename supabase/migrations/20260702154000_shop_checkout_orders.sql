CREATE TABLE IF NOT EXISTS public.shop_checkout_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES public.medicines(id),
  selected_package_id uuid NULL REFERENCES public.packages(id),
  selected_plan_code text NOT NULL CHECK (selected_plan_code IN ('monthly', 'quarterly')),
  payment_method_code text NOT NULL CHECK (payment_method_code IN ('card', 'alt', 'new')),
  promo_code text NULL,
  promo_savings numeric(10, 2) NOT NULL DEFAULT 0,
  subtotal numeric(10, 2) NOT NULL,
  shipping numeric(10, 2) NOT NULL DEFAULT 0,
  total numeric(10, 2) NOT NULL,
  status text NOT NULL DEFAULT 'pending_payment' CHECK (status IN ('pending_payment', 'paid', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_checkout_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.shop_checkout_orders(id) ON DELETE CASCADE,
  medicine_id uuid NOT NULL REFERENCES public.medicines(id),
  package_id uuid NULL REFERENCES public.packages(id),
  name text NOT NULL,
  description text NOT NULL,
  image_url text NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10, 2) NOT NULL,
  line_total numeric(10, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shop_checkout_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.shop_checkout_orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shop_checkout_orders_user_id
  ON public.shop_checkout_orders(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_checkout_order_items_order_id
  ON public.shop_checkout_order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_shop_checkout_events_order_id
  ON public.shop_checkout_events(order_id, created_at DESC);

ALTER TABLE public.shop_checkout_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_checkout_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_checkout_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own shop checkout orders" ON public.shop_checkout_orders;
CREATE POLICY "Users view own shop checkout orders"
  ON public.shop_checkout_orders
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users insert own shop checkout orders" ON public.shop_checkout_orders;
CREATE POLICY "Users insert own shop checkout orders"
  ON public.shop_checkout_orders
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users view own shop checkout order items" ON public.shop_checkout_order_items;
CREATE POLICY "Users view own shop checkout order items"
  ON public.shop_checkout_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.shop_checkout_orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users insert own shop checkout order items" ON public.shop_checkout_order_items;
CREATE POLICY "Users insert own shop checkout order items"
  ON public.shop_checkout_order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shop_checkout_orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users view own shop checkout events" ON public.shop_checkout_events;
CREATE POLICY "Users view own shop checkout events"
  ON public.shop_checkout_events
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.shop_checkout_orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users insert own shop checkout events" ON public.shop_checkout_events;
CREATE POLICY "Users insert own shop checkout events"
  ON public.shop_checkout_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.shop_checkout_orders o
      WHERE o.id = order_id AND o.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT ON public.shop_checkout_orders TO authenticated;
GRANT SELECT, INSERT ON public.shop_checkout_order_items TO authenticated;
GRANT SELECT, INSERT ON public.shop_checkout_events TO authenticated;

GRANT ALL ON public.shop_checkout_orders TO service_role;
GRANT ALL ON public.shop_checkout_order_items TO service_role;
GRANT ALL ON public.shop_checkout_events TO service_role;

DROP TRIGGER IF EXISTS update_shop_checkout_orders_updated_at ON public.shop_checkout_orders;
CREATE TRIGGER update_shop_checkout_orders_updated_at
  BEFORE UPDATE ON public.shop_checkout_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
