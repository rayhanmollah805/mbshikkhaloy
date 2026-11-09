"use client";

import { PaymentsView } from "@/components/payments-view";
import { useRequireUser } from "@/lib/auth";

export default function AdminPayments() {
  const user = useRequireUser("ADMIN");
  return user ? <PaymentsView /> : null;
}
