import VariantBadge from "@/app/_components/checkInGuest/VariantBadge";
import { Wallet2 } from "lucide-react";
import React, { FC, Fragment } from "react";
import { FaUserCircle } from "react-icons/fa";
import { FiAtSign } from "react-icons/fi";
import { Visitor } from "./VisitorsTable"; // Adjust the path if needed

interface VisitorRowProps {
  visitor: Visitor;
  refProp: any;
  webApp: any;
  index: number;
  isLast: boolean;
  needRefresh: boolean;
}

const VisitorRow: FC<VisitorRowProps> = ({ visitor, refProp, webApp, index, isLast, needRefresh }) => {
  if (!visitor) {
    return null;
  }

  return (
    <Fragment key={(visitor.user_id || index) + Math.random()}>
      <div
        className="flex w-full p-4 text-sm border-b border-gray-700"
        ref={isLast ? refProp : null}
      >
        <div className="flex-1 truncate">
          <div className="inline-flex items-center dark:text-gray-100 text-gray-700">
            <FaUserCircle className="mr-2" />
            {`${visitor?.first_name} ${visitor?.last_name}`}
          </div>
          <br />
          <a
            className="flex-1 truncate text-xs py-0 italic cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (visitor?.username) {
                webApp?.openTelegramLink(`https://t.me/${visitor?.username}`);
              }
            }}
          >
            <div className="inline-flex items-center py-0 text-gray-600 dark:text-gray-400">
              <FiAtSign className="ml-5 mr-0" />
              {visitor?.username ? `${visitor?.username}` : "No Username"}
            </div>
          </a>
        </div>

        <div className="flex-1 flex justify-end items-center">
          {!visitor.has_ticket ? (
            <div
              className="cursor-pointer"
              onClick={(e) => {
                e.preventDefault();
                if (visitor?.wallet_address) {
                  webApp?.openLink(`https://tonviewer.com/${visitor?.wallet_address}`);
                }
              }}
            >
              {visitor?.wallet_address ? (
                <div className="inline-flex items-center py-0">
                  <Wallet2
                    className="mr-2"
                    width={12}
                    height={12}
                  />{" "}
                  open wallet
                </div>
              ) : (
                <>No Wallet</>
              )}
            </div>
          ) : visitor?.ticket_id !== Number(needRefresh) && visitor?.ticket_id ? (
            <VariantBadge
              key={visitor?.created_at?.toString()}
              status={visitor?.ticket_status || ""}
            />
          ) : (
            <VariantBadge
              key={visitor?.created_at?.toString()}
              status={visitor?.ticket_status || ""}
            />
          )}
        </div>
      </div>
    </Fragment>
  );
};

export default React.memo(VisitorRow);
