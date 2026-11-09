"use client";

import { EmptyState } from "@/components/ui";
import { PaymentsView } from "@/components/payments-view";
import { can, useRequireUser } from "@/lib/auth";

// Teachers see this only when the admin granted them payment.manage.
export default function TeacherPayments() {
  const user = useRequireUser("TEACHER", "ADMIN");
  if (!user) return null;
  if (!can(user, "payment.manage")) {
    return <EmptyState icon="lock" title="এই অংশে আপনার অ্যাক্সেস নেই" hint="পেমেন্ট অনুমোদনের অনুমতি পেতে অ্যাডমিনের সাথে যোগাযোগ করুন।" />;
  }
  return <PaymentsView />;
}
