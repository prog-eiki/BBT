'use client';

import React, { useMemo, useState } from 'react';
import { Check, Lock, Search, Shield, Sparkles, X } from 'lucide-react';
import {
  AGENT_ROLES_META,
  getRoleColor,
  VALORANT_AGENTS_LIST,
} from '@/lib/valorant-data';
import type { AgentRole } from '@/types/hq';

interface AgentPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAgentId: string | null;
  usedAgentIds: string[];
  allowDuplicateAgents: boolean;
  onToggleAllowDuplicates: (allow: boolean) => void;
  onSelectAgent: (agentId: string) => void;
  slotLabel: string;
  playerName?: string;
}

export const AgentPickerModal: React.FC<AgentPickerModalProps> = ({
  isOpen,
  onClose,
  selectedAgentId,
  usedAgentIds,
  allowDuplicateAgents,
  onToggleAllowDuplicates,
  onSelectAgent,
  slotLabel,
  playerName,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<AgentRole | 'ALL'>('ALL');
  const [brokenImages, setBrokenImages] = useState<Record<string, boolean>>({});

  const filteredAgents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return VALORANT_AGENTS_LIST.filter((agent) => {
      if (roleFilter !== 'ALL' && agent.role !== roleFilter) return false;
      if (
        q &&
        !agent.name.toLowerCase().includes(q) &&
        !agent.role.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [searchQuery, roleFilter]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0F1117] border border-[#C8A273]/30 shadow-[0_24px_80px_rgba(0,0,0,0.95)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full bg-gradient-to-r from-[#9E141B] via-[#C8A273] to-[#9E141B]" />

        {/* Header */}
        <div className="px-6 py-4 bg-[#14171F] border-b border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#C8A273]">
              <Sparkles className="w-3.5 h-3.5 text-[#9E141B]" />
              <span>
                {slotLabel} {playerName ? `• ${playerName}` : ''}
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold uppercase tracking-wider text-white">
              Agent auswählen
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-[#ECE8E1] select-none bg-[#090A0E] px-3 py-2 rounded-xl border border-white/10">
              <input
                type="checkbox"
                checked={allowDuplicateAgents}
                onChange={(e) => onToggleAllowDuplicates(e.target.checked)}
                className="accent-[#9E141B] w-4 h-4 rounded"
              />
              <span>Agent-Duplikate erlauben</span>
            </label>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-[#9E141B] text-[#878C8F] hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="px-6 py-3.5 bg-[#0B0D12] border-b border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Role Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRoleFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition ${
                roleFilter === 'ALL'
                  ? 'bg-[#9E141B] text-white'
                  : 'bg-[#14171F] text-[#878C8F] hover:text-white border border-white/10'
              }`}
            >
              Alle ({VALORANT_AGENTS_LIST.length})
            </button>

            {AGENT_ROLES_META.map((r) => {
              const active = roleFilter === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoleFilter(r.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition flex items-center gap-1.5 ${
                    active
                      ? 'bg-[#9E141B] text-white'
                      : 'bg-[#14171F] text-[#878C8F] hover:text-white border border-white/10'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: r.color }}
                  />
                  <span>{r.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search Input */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-[#878C8F] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Agent suchen..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#14171F] border border-white/10 text-xs text-white focus:outline-none focus:border-[#9E141B]"
            />
          </div>
        </div>

        {/* Agent Grid */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {filteredAgents.map((agent) => {
            const isSelected =
              selectedAgentId?.toLowerCase() === agent.id.toLowerCase();
            const isUsedElsewhere =
              !isSelected &&
              usedAgentIds.some(
                (id) => id.toLowerCase() === agent.id.toLowerCase()
              );
            const isLocked = isUsedElsewhere && !allowDuplicateAgents;
            const roleColor = getRoleColor(agent.role);
            const hasImage =
              Boolean(agent.displayIcon) && !brokenImages[agent.id];

            return (
              <button
                key={agent.id}
                type="button"
                disabled={isLocked}
                onClick={() => {
                  onSelectAgent(agent.id);
                  onClose();
                }}
                className={`group relative rounded-xl p-3 border text-left transition flex flex-col items-center ${
                  isSelected
                    ? 'bg-gradient-to-b from-[#9E141B]/35 to-[#14171F] border-[#9E141B] shadow-[0_0_20px_rgba(158,20,27,0.45)]'
                    : isLocked
                    ? 'bg-[#0B0D12]/60 border-white/5 opacity-45 cursor-not-allowed'
                    : 'bg-[#14171F] border-white/10 hover:border-[#C8A273]/50 hover:bg-[#191D28]'
                }`}
              >
                {/* Status Badge Top Right */}
                {isSelected && (
                  <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#73FBD3] text-[#07080A] flex items-center justify-center shadow">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                )}
                {isLocked && (
                  <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-[10px] font-mono text-[#878C8F] flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5" />
                    <span>Belegt</span>
                  </span>
                )}

                {/* Agent Portrait or Clean Fallback Placeholder */}
                <div className="w-20 h-20 rounded-xl bg-[#090A0E] border border-white/10 overflow-hidden flex items-center justify-center mb-2.5 relative">
                  {hasImage ? (
                    <img
                      src={agent.displayIcon}
                      alt={agent.name}
                      onError={() =>
                        setBrokenImages((prev) => ({
                          ...prev,
                          [agent.id]: true,
                        }))
                      }
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-200"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center p-1">
                      <Shield
                        className="w-6 h-6 mb-1"
                        style={{ color: roleColor }}
                      />
                      <span className="text-[11px] font-display font-bold uppercase text-[#C8A273]">
                        {agent.name}
                      </span>
                    </div>
                  )}
                </div>

                <div className="font-display font-bold text-sm uppercase tracking-wider text-white">
                  {agent.name}
                </div>
                <div
                  className="text-[10px] font-mono uppercase tracking-wider mt-0.5"
                  style={{ color: roleColor }}
                >
                  {agent.role}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
