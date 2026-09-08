"use client";

import { useState } from "react";
import type { Reservation } from "../../../_lib/types";
import { Badge } from "../../ui";

const GENDER_LABEL: Record<"male" | "female", string> = {
  male: "남성팀",
  female: "여성팀",
};

/** 과팅 O/X 배지 + 펼쳐보기로 보는 주문 영수증(메뉴별 수량) 및 과팅 참석자 학과 */
export function ReservationDetails({ reservation }: { reservation: Reservation }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5"
      >
        <Badge tone={reservation.matching ? "purple" : "neutral"}>
          과팅 {reservation.matching ? "O" : "X"}
        </Badge>
        <span className="text-xs text-neutral-500 underline-offset-2 hover:underline dark:text-neutral-400">
          {open ? "영수증 접기 ▲" : "영수증 보기 ▼"}
        </span>
      </button>

      {open && (
        <div className="mt-2 w-full max-w-xs rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-3 font-mono text-[11px] leading-5 text-neutral-700 dark:border-neutral-700 dark:bg-white/[0.03] dark:text-neutral-300">
          <div className="text-center text-[11px] font-semibold text-neutral-500 dark:text-neutral-400">
            {reservation.boothName} 영수증
          </div>
          <div className="my-1.5 border-t border-dashed border-neutral-300 dark:border-neutral-700" />

          {reservation.orderItems.map((item, i) => (
            <div key={i} className="flex justify-between gap-2">
              <span className="truncate">
                {item.menuName} × {item.quantity}
              </span>
              <span className="whitespace-nowrap">
                {(item.unitPrice * item.quantity).toLocaleString()}원
              </span>
            </div>
          ))}

          <div className="my-1.5 border-t border-dashed border-neutral-300 dark:border-neutral-700" />
          <div className="flex justify-between">
            <span>메뉴 합계</span>
            <span>{reservation.menuAmount.toLocaleString()}원</span>
          </div>

          {reservation.matching && (
            <>
              <div className="flex justify-between text-purple-600 dark:text-purple-400">
                <span>과팅 비용</span>
                <span>{reservation.matchingFee.toLocaleString()}원</span>
              </div>
              <div className="my-1.5 border-t border-dashed border-neutral-300 dark:border-neutral-700" />
              {reservation.matchingGender && (
                <div className="mb-1 text-purple-600 dark:text-purple-400">
                  {GENDER_LABEL[reservation.matchingGender]}
                </div>
              )}
              {(reservation.participantDepartments ?? []).map((dept, i) => (
                <div key={i} className="flex justify-between gap-2">
                  <span>{i === 0 ? "대표자" : `참석자${i}`}</span>
                  <span>{dept}</span>
                </div>
              ))}
              <div className="my-1.5 border-t border-dashed border-neutral-300 dark:border-neutral-700" />
            </>
          )}

          <div className="flex justify-between text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <span>합계</span>
            <span>{reservation.totalAmount.toLocaleString()}원</span>
          </div>
        </div>
      )}
    </div>
  );
}
