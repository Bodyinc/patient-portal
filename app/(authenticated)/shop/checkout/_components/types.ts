import type {
  ShopCheckoutBootstrapDto,
  ShopCheckoutOrderCreateInput,
  ShopCheckoutPaymentMethodDto,
  ShopCheckoutPlanDto,
  ShopCheckoutProductDto,
} from "@/lib/shop/service-types";

export type CheckoutPlanId = ShopCheckoutPlanDto["code"];
export type CheckoutPaymentMethodId = ShopCheckoutPaymentMethodDto["id"];
export type CheckoutProduct = ShopCheckoutProductDto;
export type CheckoutPlan = ShopCheckoutPlanDto;
export type CheckoutPaymentMethod = ShopCheckoutPaymentMethodDto;
export type CheckoutBootstrap = ShopCheckoutBootstrapDto;
export type CheckoutOrderCreateInput = ShopCheckoutOrderCreateInput;
