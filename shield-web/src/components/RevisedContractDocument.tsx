import React from "react";

interface Clause {
  id: string;
  clause_text: string;
  category: string;
  risk_level: string;
  resolved_by_tenant: boolean;
  resolved_by_landlord: boolean;
  explanation?: string;
}

interface RevisedContractDocumentProps {
  clauses: Clause[];
  sessionDate?: string;
  imageUrl?: string;
  hidden?: boolean;
  previewMode?: boolean;
}

export const RevisedContractDocument: React.FC<RevisedContractDocumentProps> = ({ clauses, sessionDate, imageUrl, hidden = false, previewMode = false }) => {
  // In preview mode, we show all clauses that are meant to be added as special terms (risk, warning, missing).
  // Otherwise, we only show fully resolved ones.
  const resolvedClauses = clauses.filter(
    (c) => previewMode ? (c.risk_level === '위험' || c.risk_level === '주의' || c.category?.includes('누락') || !c.category) : (c.resolved_by_tenant && c.resolved_by_landlord)
  );

  return (
    <div id="pdf-contract-document" style={{ width: "210mm", height: "297mm", position: "relative", backgroundColor: "white", color: "black", fontFamily: "'Noto Sans KR', sans-serif" }} className={hidden ? "hidden absolute left-[-9999px]" : ""}>
      {/* Background Image */}
      {imageUrl && (
        <img
          src={imageUrl}
          alt="원본 계약서"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain", // or cover depending on how we want it
            position: "absolute",
            top: 0,
            left: 0,
            zIndex: 0
          }}
        />
      )}

      {/* Overlay Content */}
      <div style={{
        position: "absolute",
        top: "55%", // placing right beneath the rules
        left: "10%",
        width: "80%",
        backgroundColor: "rgba(255, 255, 255, 1)", // slightly transparent so it blends
        padding: "15px",
        border: "2px solid #000",
        zIndex: 10
      }}>
        <h2 style={{ textAlign: "center", fontSize: "16pt", fontWeight: "bold", marginBottom: "10px" }}>
          [ 특 약 사 항 ]
        </h2>
        <div style={{ fontSize: "10pt", lineHeight: "1.6" }}>
          {resolvedClauses.length > 0 ? (
            <ul style={{ paddingLeft: "20px", margin: 0 }}>
              {resolvedClauses.map((clause, index) => (
                <li key={clause.id} style={{ marginBottom: "8px" }}>
                  <strong>{clause.category || `조항 ${index + 1}`}</strong>: {clause.explanation || clause.clause_text}
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ textAlign: "center", margin: 0 }}>현재 상호 합의(해결) 처리된 특약 조항이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
};
