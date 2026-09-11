import type { Metadata } from "next";
import Link from "next/link";
import { getContactInfo } from "@/app/admin/_lib/firestore-settings";
import { ContactDisplay } from "../_components/ContactDisplay";

export const metadata: Metadata = {
  title: "예약 안내",
  description: "Frequency 예약 확정자 안내사항",
};

// 문의처 등 관리자가 바꾸는 정보가 즉시 반영되어야 해서 캐시 없이 매 요청마다 새로 조회함(SSR)
export const dynamic = "force-dynamic";

export default async function FestivalNoticePage() {
  const contact = await getContactInfo().catch(() => null);

  return (
    <main className="min-h-screen w-full bg-neutral-100 text-neutral-900 dark:bg-[#0b0805] dark:text-neutral-100">
      <div className="mx-auto flex w-full max-w-[440px] flex-col px-5 pt-8 pb-16">
        <Link
          href="/festival"
          className="inline-flex w-fit items-center gap-1 text-sm text-neutral-500 transition hover:text-amber-600 dark:text-neutral-400 dark:hover:text-amber-400"
        >
          ← 축제 페이지로
        </Link>

        <header className="mt-4 text-center">
          <div className="text-xs font-medium tracking-wide text-amber-600 dark:text-amber-400">
            Frequency
          </div>
          <h1 className="mt-2 text-2xl font-bold text-neutral-900 dark:text-neutral-50">
            예약 안내
          </h1>
          <p className="mt-2 text-sm leading-6 text-neutral-500 dark:text-neutral-400">
            예약을 확정하신 분들은 아래 내용을 꼭 확인해주세요.
          </p>
        </header>

        <div className="mt-8 space-y-4">
          <Section num={1} title="예약 확정은 이렇게 진행돼요">
            예약을 접수하신 뒤, 저희가 입금 내역을 직접 확인하고 예약을 확정합니다. 확정
            여부는 예약 시 남겨주신 전화번호로{" "}
            <b className="font-semibold text-neutral-800 dark:text-neutral-100">
              카카오톡을 통해 개별 안내
            </b>
            드려요. 아직 연락을 못 받으셨다면 확인 중인 상태이니 조금만 기다려주세요.
          </Section>

          <Section num={2} title="과팅(매칭) 신청하셨다면" accent>
            <p>
              매칭을 신청하신 분들께는 저희가{" "}
              <b className="font-semibold text-neutral-800 dark:text-neutral-100">
                별칭을 배정
              </b>
              해 드려요. 상대팀 소개와 매칭 성사 여부는 카카오톡으로 안내드리며, 현장에서는
              이 별칭으로 서로를 확인하시면 됩니다.
            </p>
            <p className="mt-3">
              아쉽게 매칭 상대를 찾지 못한 경우, 예약을 취소해드리거나 상대 팀 매칭 없이
              예약자분들끼리 그대로 이용하실지 여부를 카카오톡으로 안내드립니다.
            </p>
            <div className="mt-3 rounded-xl border border-purple-400/30 bg-purple-500/[0.06] p-3 text-[13px] leading-5">
              매칭 상대팀이 약속 시간 기준{" "}
              <b className="font-semibold">15분 이상</b> 나타나지 않으면, 저희 카카오톡으로
              바로 알려주세요. 확인 후 매칭 비용을 환불해드리고,{" "}
              <b className="font-semibold">테이블 정원 안에서</b> 다른 친구를 추가로 불러
              이용하실 수 있도록 도와드릴게요.
            </div>
          </Section>

          <Section num={3} title="노쇼 안내">
            예약 시간에 맞춰 방문해주세요. 시간이 지나도 도착하지 않으면 안내 전화를
            드리며, 전화를 받지 않으실 경우{" "}
            <b className="font-semibold text-neutral-800 dark:text-neutral-100">
              예약이 취소되고 입금하신 금액이 환불되지 않을 수 있습니다.
            </b>{" "}
            늦으실 것 같으면 미리 연락 주시면 최대한 자리를 유지해드릴게요.
          </Section>

          <Section num={4} title="이 밖에 꼭 알아두세요">
            <ul className="list-inside list-disc space-y-2 marker:text-amber-500">
              <li>
                입금자명은{" "}
                <b className="font-semibold text-neutral-800 dark:text-neutral-100">
                  예약 시 적어주신 이름 + 전화번호 뒤 4자리
                </b>
                (예: 홍길동 1234)로 해주세요. 예약 화면에도 안내되어 있어요. 형식이
                다르면 확인이 늦어질 수 있어요.
              </li>
              <li>전화번호 하나로는 예약을 한 건만 하실 수 있어요.</li>
              <li>
                예약 내용을 변경하거나 취소하고 싶으시면 방문 예정 시간 전에 미리
                카카오톡으로 알려주세요.
              </li>
              <li>남겨주신 전화번호는 예약 확인·환불 안내 목적으로만 사용됩니다.</li>
            </ul>
          </Section>
        </div>

        <div className="mt-8 rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/[0.06] p-4 text-center text-xs leading-5 text-amber-700 dark:text-amber-400">
          문의사항은 아래로 연락해주세요.
          <br />
          {contact ? (
            <ContactDisplay value={contact} />
          ) : (
            <span className="opacity-70">문의처가 아직 등록되지 않았습니다.</span>
          )}
        </div>
      </div>
    </main>
  );
}

function Section({
  num,
  title,
  accent,
  children,
}: {
  num: number;
  title: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-black/5 bg-white p-4 dark:border-white/5 dark:bg-white/[0.03]">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        <span
          className={`grid h-5 w-5 flex-shrink-0 place-items-center rounded-full text-[11px] font-bold ${
            accent
              ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          }`}
        >
          {num}
        </span>
        {title}
      </h2>
      <div className="mt-2.5 pl-7 text-[13px] leading-6 text-neutral-600 dark:text-neutral-300">
        {children}
      </div>
    </section>
  );
}
