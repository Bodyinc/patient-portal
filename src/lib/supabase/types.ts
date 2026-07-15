export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      intake_session_categories: {
        Row: {
          session_id: string;
          category_id: string;
          created_at: string;
        };
        Insert: {
          session_id: string;
          category_id: string;
          created_at?: string;
        };
        Update: {
          session_id?: string;
          category_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intake_session_categories_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "medication_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      intake_session_eligibility_results: {
        Row: {
          id: string;
          session_id: string;
          medicine_id: string;
          result: Database["public"]["Enums"]["eligibility_result"];
          reason: string | null;
          evaluated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          medicine_id: string;
          result: Database["public"]["Enums"]["eligibility_result"];
          reason?: string | null;
          evaluated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          medicine_id?: string;
          result?: Database["public"]["Enums"]["eligibility_result"];
          reason?: string | null;
          evaluated_at?: string;
        };
        Relationships: [];
      };
      intake_session_medicines: {
        Row: {
          session_id: string;
          category_id: string;
          medicine_id: string;
          created_at: string;
        };
        Insert: {
          session_id: string;
          category_id: string;
          medicine_id: string;
          created_at?: string;
        };
        Update: {
          session_id?: string;
          category_id?: string;
          medicine_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intake_session_medicines_medicine_id_fkey";
            columns: ["medicine_id"];
            isOneToOne: false;
            referencedRelation: "medicines";
            referencedColumns: ["id"];
          },
        ];
      };
      intake_session_questionnaire_responses: {
        Row: {
          id: string;
          session_id: string;
          medicine_id: string;
          question_id: string;
          answer_text: string | null;
          answer_number: number | null;
          answer_boolean: boolean | null;
          answer_option_ids: string[];
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          medicine_id: string;
          question_id: string;
          answer_text?: string | null;
          answer_number?: number | null;
          answer_boolean?: boolean | null;
          answer_option_ids?: string[];
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          medicine_id?: string;
          question_id?: string;
          answer_text?: string | null;
          answer_number?: number | null;
          answer_boolean?: boolean | null;
          answer_option_ids?: string[];
          created_at?: string;
        };
        Relationships: [];
      };
      email_reminders: {
        Row: {
          id: string;
          reminder_type: string;
          target_id: string;
          period_key: string;
          sent_at: string;
        };
        Insert: {
          id?: string;
          reminder_type: string;
          target_id: string;
          period_key?: string;
          sent_at?: string;
        };
        Update: {
          id?: string;
          reminder_type?: string;
          target_id?: string;
          period_key?: string;
          sent_at?: string;
        };
        Relationships: [];
      };
      intake_sessions: {
        Row: {
          id: string;
          session_token: string;
          state_code: string | null;
          sex: Database["public"]["Enums"]["sex_type"] | null;
          dob: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          full_name: string | null;
          email: string | null;
          phone: string | null;
          selected_plan_id: string | null;
          status: Database["public"]["Enums"]["intake_session_status"];
          claimed_by_user_id: string | null;
          created_at: string;
          updated_at: string;
          expires_at: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
        };
        Insert: {
          id?: string;
          session_token: string;
          state_code?: string | null;
          sex?: Database["public"]["Enums"]["sex_type"] | null;
          dob?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          selected_plan_id?: string | null;
          status?: Database["public"]["Enums"]["intake_session_status"];
          claimed_by_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
          expires_at?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
        };
        Update: {
          id?: string;
          session_token?: string;
          state_code?: string | null;
          sex?: Database["public"]["Enums"]["sex_type"] | null;
          dob?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          selected_plan_id?: string | null;
          status?: Database["public"]["Enums"]["intake_session_status"];
          claimed_by_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
          expires_at?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
        };
        Relationships: [];
      };
      medication_categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          tagline: string | null;
          description: string | null;
          icon: string | null;
          eligibility_rules: Json;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          tagline?: string | null;
          description?: string | null;
          icon?: string | null;
          eligibility_rules?: Json;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          tagline?: string | null;
          description?: string | null;
          icon?: string | null;
          eligibility_rules?: Json;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      medication_category_medicines: {
        Row: {
          category_id: string;
          medicine_id: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          category_id: string;
          medicine_id: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          category_id?: string;
          medicine_id?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      medication_relationships: {
        Row: {
          id: string;
          medicine_a_id: string;
          medicine_b_id: string;
          relationship: Database["public"]["Enums"]["medication_relationship"];
          reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          medicine_a_id: string;
          medicine_b_id: string;
          relationship: Database["public"]["Enums"]["medication_relationship"];
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          medicine_a_id?: string;
          medicine_b_id?: string;
          relationship?: Database["public"]["Enums"]["medication_relationship"];
          reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      medicines: {
        Row: {
          id: string;
          name: string;
          short_description: string;
          long_description: string | null;
          image_url: string | null;
          price_monthly: number;
          status: Database["public"]["Enums"]["medicine_status"];
          important_info: Json;
          notice_text: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          requires_questionnaire: boolean;
          stripe_product_id: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          short_description: string;
          long_description?: string | null;
          image_url?: string | null;
          price_monthly?: number;
          status?: Database["public"]["Enums"]["medicine_status"];
          important_info?: Json;
          notice_text?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          requires_questionnaire?: boolean;
          stripe_product_id?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          short_description?: string;
          long_description?: string | null;
          image_url?: string | null;
          price_monthly?: number;
          status?: Database["public"]["Enums"]["medicine_status"];
          important_info?: Json;
          notice_text?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          requires_questionnaire?: boolean;
          stripe_product_id?: string | null;
        };
        Relationships: [];
      };
      packages: {
        Row: {
          id: string;
          medicine_id: string;
          name: string;
          duration_months: number;
          original_price: number;
          price: number;
          is_most_popular: boolean;
          features: Json;
          clinical_note: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
          stripe_price_id: string | null;
        };
        Insert: {
          id?: string;
          medicine_id: string;
          name: string;
          duration_months: number;
          original_price?: number;
          price?: number;
          is_most_popular?: boolean;
          features?: Json;
          clinical_note?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          stripe_price_id?: string | null;
        };
        Update: {
          id?: string;
          medicine_id?: string;
          name?: string;
          duration_months?: number;
          original_price?: number;
          price?: number;
          is_most_popular?: boolean;
          features?: Json;
          clinical_note?: string | null;
          sort_order?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
          stripe_price_id?: string | null;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          session_id: string | null;
          user_id: string | null;
          plan_id: string | null;
          stripe_subscription_id: string | null;
          stripe_invoice_id: string | null;
          stripe_payment_intent_id: string | null;
          stripe_customer_id: string | null;
          amount_cents: number;
          currency: string;
          status: string;
          raw_event: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id?: string | null;
          user_id?: string | null;
          plan_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_customer_id?: string | null;
          amount_cents: number;
          currency?: string;
          status?: string;
          raw_event?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string | null;
          user_id?: string | null;
          plan_id?: string | null;
          stripe_subscription_id?: string | null;
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
          stripe_customer_id?: string | null;
          amount_cents?: number;
          currency?: string;
          status?: string;
          raw_event?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      refund_requests: {
        Row: {
          id: string;
          user_id: string | null;
          payment_id: string;
          subscription_id: string | null;
          amount_cents: number;
          reason: string | null;
          status: string;
          admin_note: string | null;
          stripe_refund_id: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          payment_id: string;
          subscription_id?: string | null;
          amount_cents: number;
          reason?: string | null;
          status?: string;
          admin_note?: string | null;
          stripe_refund_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          payment_id?: string;
          subscription_id?: string | null;
          amount_cents?: number;
          reason?: string | null;
          status?: string;
          admin_note?: string | null;
          stripe_refund_id?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stripe_events: {
        Row: {
          id: string;
          stripe_event_id: string;
          type: string;
          payload: Json;
          received_at: string;
        };
        Insert: {
          id?: string;
          stripe_event_id: string;
          type: string;
          payload: Json;
          received_at?: string;
        };
        Update: {
          id?: string;
          stripe_event_id?: string;
          type?: string;
          payload?: Json;
          received_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          stripe_subscription_id: string;
          stripe_customer_id: string | null;
          stripe_price_id: string | null;
          package_id: string | null;
          medicine_id: string | null;
          status: string;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          stripe_subscription_id: string;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          package_id?: string | null;
          medicine_id?: string | null;
          status?: string;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          session_id?: string | null;
          stripe_subscription_id?: string;
          stripe_customer_id?: string | null;
          stripe_price_id?: string | null;
          package_id?: string | null;
          medicine_id?: string | null;
          status?: string;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_medicine_id_fkey";
            columns: ["medicine_id"];
            isOneToOne: false;
            referencedRelation: "medicines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_cancellation_feedback: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string;
          stripe_subscription_id: string;
          reasons: string[];
          other_text: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_id: string;
          stripe_subscription_id: string;
          reasons: string[];
          other_text?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subscription_id?: string;
          stripe_subscription_id?: string;
          reasons?: string[];
          other_text?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      promo_codes: {
        Row: {
          id: string;
          code: string;
          stripe_coupon_id: string | null;
          stripe_promotion_code_id: string | null;
          discount_type: string;
          percent_off: number | null;
          amount_off_cents: number | null;
          currency: string;
          duration: string;
          duration_in_months: number | null;
          max_redemptions: number | null;
          redeem_by: string | null;
          is_active: boolean;
          auto_apply: boolean;
          times_redeemed: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          stripe_coupon_id?: string | null;
          stripe_promotion_code_id?: string | null;
          discount_type: string;
          percent_off?: number | null;
          amount_off_cents?: number | null;
          currency?: string;
          duration?: string;
          duration_in_months?: number | null;
          max_redemptions?: number | null;
          redeem_by?: string | null;
          is_active?: boolean;
          auto_apply?: boolean;
          times_redeemed?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          stripe_coupon_id?: string | null;
          stripe_promotion_code_id?: string | null;
          discount_type?: string;
          percent_off?: number | null;
          amount_off_cents?: number | null;
          currency?: string;
          duration?: string;
          duration_in_months?: number | null;
          max_redemptions?: number | null;
          redeem_by?: string | null;
          is_active?: boolean;
          auto_apply?: boolean;
          times_redeemed?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      shop_checkout_events: {
        Row: {
          id: string;
          order_id: string;
          event_type: string;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          event_type: string;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          event_type?: string;
          payload?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      shop_checkout_order_items: {
        Row: {
          id: string;
          order_id: string;
          medicine_id: string;
          package_id: string | null;
          name: string;
          description: string;
          image_url: string | null;
          quantity: number;
          unit_price: number;
          line_total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          medicine_id: string;
          package_id?: string | null;
          name: string;
          description: string;
          image_url?: string | null;
          quantity?: number;
          unit_price: number;
          line_total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          medicine_id?: string;
          package_id?: string | null;
          name?: string;
          description?: string;
          image_url?: string | null;
          quantity?: number;
          unit_price?: number;
          line_total?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      shop_checkout_orders: {
        Row: {
          id: string;
          user_id: string;
          medicine_id: string;
          selected_package_id: string | null;
          selected_plan_code: string;
          payment_method_code: string;
          promo_code: string | null;
          promo_savings: number;
          subtotal: number;
          shipping: number;
          consultation: number;
          total: number;
          status: string;
          created_at: string;
          updated_at: string;
          stripe_subscription_id: string | null;
          stripe_invoice_id: string | null;
          stripe_payment_intent_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          medicine_id: string;
          selected_package_id?: string | null;
          selected_plan_code: string;
          payment_method_code: string;
          promo_code?: string | null;
          promo_savings?: number;
          subtotal: number;
          shipping?: number;
          consultation?: number;
          total: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
          stripe_subscription_id?: string | null;
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          medicine_id?: string;
          selected_package_id?: string | null;
          selected_plan_code?: string;
          payment_method_code?: string;
          promo_code?: string | null;
          promo_savings?: number;
          subtotal?: number;
          shipping?: number;
          consultation?: number;
          total?: number;
          status?: string;
          created_at?: string;
          updated_at?: string;
          stripe_subscription_id?: string | null;
          stripe_invoice_id?: string | null;
          stripe_payment_intent_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          dob: string | null;
          email: string;
          avatar_url: string | null;
          street_address: string | null;
          city: string | null;
          state_code: string | null;
          postal_code: string | null;
          country: string | null;
          sex: Database["public"]["Enums"]["sex_type"] | null;
          created_at: string;
          updated_at: string;
          stripe_customer_id: string | null;
          referral_code: string | null;
        };
        Insert: {
          id: string;
          full_name: string;
          phone?: string | null;
          dob?: string | null;
          email: string;
          avatar_url?: string | null;
          street_address?: string | null;
          city?: string | null;
          state_code?: string | null;
          postal_code?: string | null;
          country?: string | null;
          sex?: Database["public"]["Enums"]["sex_type"] | null;
          created_at?: string;
          updated_at?: string;
          stripe_customer_id?: string | null;
          referral_code?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          dob?: string | null;
          email?: string;
          avatar_url?: string | null;
          street_address?: string | null;
          city?: string | null;
          state_code?: string | null;
          postal_code?: string | null;
          country?: string | null;
          sex?: Database["public"]["Enums"]["sex_type"] | null;
          created_at?: string;
          updated_at?: string;
          stripe_customer_id?: string | null;
          referral_code?: string | null;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          id: string;
          referrer_user_id: string;
          referred_user_id: string | null;
          code: string;
          status: string;
          reward_cents: number;
          stripe_balance_txn_id: string | null;
          created_at: string;
          converted_at: string | null;
        };
        Insert: {
          id?: string;
          referrer_user_id: string;
          referred_user_id?: string | null;
          code: string;
          status?: string;
          reward_cents?: number;
          stripe_balance_txn_id?: string | null;
          created_at?: string;
          converted_at?: string | null;
        };
        Update: {
          id?: string;
          referrer_user_id?: string;
          referred_user_id?: string | null;
          code?: string;
          status?: string;
          reward_cents?: number;
          stripe_balance_txn_id?: string | null;
          created_at?: string;
          converted_at?: string | null;
        };
        Relationships: [];
      };
      questionnaire_medicines: {
        Row: {
          questionnaire_id: string;
          medicine_id: string;
          created_at: string;
        };
        Insert: {
          questionnaire_id: string;
          medicine_id: string;
          created_at?: string;
        };
        Update: {
          questionnaire_id?: string;
          medicine_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      questionnaire_question_options: {
        Row: {
          id: string;
          question_id: string;
          label: string;
          value: string | null;
          sort_order: number;
          is_disqualifying: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          label: string;
          value?: string | null;
          sort_order?: number;
          is_disqualifying?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          question_id?: string;
          label?: string;
          value?: string | null;
          sort_order?: number;
          is_disqualifying?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      questionnaire_questions: {
        Row: {
          id: string;
          questionnaire_id: string;
          prompt: string;
          description: string | null;
          question_type: Database["public"]["Enums"]["q_question_type"];
          is_required: boolean;
          sort_order: number;
          disqualify_rules: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          questionnaire_id: string;
          prompt: string;
          description?: string | null;
          question_type: Database["public"]["Enums"]["q_question_type"];
          is_required?: boolean;
          sort_order?: number;
          disqualify_rules?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          questionnaire_id?: string;
          prompt?: string;
          description?: string | null;
          question_type?: Database["public"]["Enums"]["q_question_type"];
          is_required?: boolean;
          sort_order?: number;
          disqualify_rules?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      questionnaires: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      wallet_transactions: {
        Row: {
          id: string;
          user_id: string;
          amount_cents: number;
          type: string;
          description: string | null;
          referral_id: string | null;
          stripe_invoice_id: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount_cents: number;
          type: string;
          description?: string | null;
          referral_id?: string | null;
          stripe_invoice_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          amount_cents?: number;
          type?: string;
          description?: string | null;
          referral_id?: string | null;
          stripe_invoice_id?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          key: string;
          value: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          key?: string;
          value?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      admin_activity_log: {
        Row: {
          id: string;
          admin_user_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          before: Json | null;
          after: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          admin_user_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          admin_user_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          before?: Json | null;
          after?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at: string;
        };
        Insert: {
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Update: {
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_my_role: {
        Args: never;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      get_user_portal: {
        Args: { _user_id: string };
        Returns: Database["public"]["Enums"]["app_role"];
      };
      get_user_role: {
        Args: { _user_id: string };
        Returns: Database["public"]["Enums"]["app_role"];
      };
    };
    Enums: {
      app_role: "admin" | "provider" | "patient";
      eligibility_result: "eligible" | "ineligible" | "needs_review";
      intake_session_status:
        "in_progress" | "payment_pending" | "completed" | "abandoned" | "expired";
      medication_relationship: "contraindicated" | "caution" | "alternative";
      medicine_status: "draft" | "active" | "published" | "archived";
      q_question_type:
        | "single_select"
        | "single_choice"
        | "multi_select"
        | "multi_choice"
        | "text"
        | "number"
        | "boolean"
        | "yes_no";
      sex_type: "male" | "female" | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "provider", "patient"],
      eligibility_result: ["eligible", "ineligible", "needs_review"],
      intake_session_status: [
        "in_progress",
        "payment_pending",
        "completed",
        "abandoned",
        "expired",
      ],
      medication_relationship: ["contraindicated", "caution", "alternative"],
      medicine_status: ["draft", "active", "published", "archived"],
      q_question_type: [
        "single_select",
        "single_choice",
        "multi_select",
        "multi_choice",
        "text",
        "number",
        "boolean",
        "yes_no",
      ],
      sex_type: ["male", "female", "other"],
    },
  },
} as const;
