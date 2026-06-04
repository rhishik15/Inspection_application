import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert
} from "react-native";
import { api } from "../api/api";
import { Colors, Spacing, BorderRadius, Shadow } from "../../constants/theme";

const choiceColors: Record<string, { bg: string; text: string; border: string }> = {
  gray: { bg: '#f8fafc', text: '#475569', border: '#cbd5e1' },
  green: { bg: '#ecfdf5', text: '#047857', border: '#a7f3d0' },
  yellow: { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  red: { bg: '#fff1f2', text: '#9f1239', border: '#fecdd3' },
  blue: { bg: '#eff6ff', text: '#1e40af', border: '#bfdbfe' }
};

export default function TaskDetailScreen({ task, user, goBack }: any) {
  const [template, setTemplate] = useState<any>(null);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [responses, setResponses] = useState<any[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    initInspection();
  }, []);

  const initInspection = async () => {
    try {
      setLoading(true);

      // start (or reuse existing) inspection
      const startRes = await api.post("/inspection/start", {
        taskId: task.id,
        workerId: user.id
      });

      const inspection = startRes.data;
      setInspectionId(inspection.id);

      // fetch template
      const templateRes = await api.get(
        `/inspection/template/${task.id}`
      );

      const temp = templateRes.data;
      setTemplate(temp);
      setExpandedSections(
        (temp.sections || []).reduce((acc: Record<string, boolean>, section: any, index: number) => {
          acc[section.id || String(index)] = index === 0;
          return acc;
        }, {})
      );

      // flatten items → responses state
      const flatItems: any[] = [];
      (temp.sections || []).forEach((section: any) => {
        (section.items || []).forEach((item: any) => {
          flatItems.push({
            itemId: item.id,
            itemName: item.label, // Include itemName for the web dashboard view
            label: item.label,
            type: item.type,
            required: item.required !== false,
            placeholder: item.placeholder,
            unit: item.unit,
            rangeMin: item.rangeMin,
            rangeMax: item.rangeMax,
            choices: item.choices,
            value: "",
            remark: ""
          });
        });
      });

      setResponses(flatItems);
    } catch (err) {
      console.log("❌ Init inspection error:", err);
      Alert.alert("Error", "Failed to load inspection template.");
    } finally {
      setLoading(false);
    }
  };

  const updateValue = (itemId: string, field: string, val: string) => {
    setResponses((current) =>
      current.map((response) =>
        response.itemId === itemId ? { ...response, [field]: val } : response
      )
    );
  };

  const getResponse = (itemId: string) => {
    return responses.find((response) => response.itemId === itemId);
  };

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((current) => ({
      ...current,
      [sectionKey]: !current[sectionKey]
    }));
  };

  const getMyAssignment = () => {
    return task.assignments?.find((assignment: any) => assignment.workerId === user?.id);
  };

  const getMyAssignmentEvents = () => {
    const events = Array.isArray(task.assignmentEvents) ? task.assignmentEvents : [];
    return events.filter((event: any) => event.workerId === user?.id);
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "Not recorded";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Not recorded";

    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  };

  const submitInspection = async () => {
    // Basic validation
    const incomplete = responses.some(r => r.required !== false && !r.value.trim());
    if (incomplete) {
      Alert.alert("Incomplete", "Please fill in all values before submitting.");
      return;
    }

    const invalidRange = responses.find((response) => {
      if (response.type !== "range" || (response.required === false && !response.value.trim())) return false;
      const numericValue = Number(response.value);
      return (
        !Number.isFinite(numericValue) ||
        response.rangeMin == null ||
        response.rangeMax == null ||
        numericValue < response.rangeMin ||
        numericValue > response.rangeMax
      );
    });

    if (invalidRange) {
      Alert.alert(
        "Invalid range",
        `${invalidRange.label} must be between ${invalidRange.rangeMin} and ${invalidRange.rangeMax}${invalidRange.unit ? ` ${invalidRange.unit}` : ""}.`
      );
      return;
    }

    try {
      if (!inspectionId) {
        Alert.alert("Error", "Inspection not initialized");
        return;
      }

      setSubmitting(true);
      await api.post("/inspection/submit", {
        inspectionId,
        responses
      });

      // 3. Mark the task as submitted in the main Task table
      await api.post(`/tasks/${task.id}/submit`);

      Alert.alert("Success", "Inspection submitted successfully", [
        { text: "OK", onPress: goBack }
      ]);
    } catch (err) {
      console.log("❌ Submit error:", err);
      Alert.alert("Error", "Error submitting inspection");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading inspection...</Text>
      </View>
    );
  }

  if (!template) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.infoText}>No template found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={goBack}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={goBack} style={styles.headerBackBtn}>
            <Text style={styles.headerBackText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Loco {task.loco?.locoNumber}
          </Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.infoSection}>
            <Text style={styles.templateName}>{template.name}</Text>
            <Text style={styles.taskStatus}>Status: {task.status}</Text>
            <Text style={styles.taskStatus}>Assigned: {formatDateTime(getMyAssignment()?.createdAt)}</Text>
            <View style={styles.historyBox}>
              <Text style={styles.historyTitle}>Assignment History</Text>
              {getMyAssignmentEvents().length === 0 && (
                <Text style={styles.historyMeta}>No assignment history recorded.</Text>
              )}
              {getMyAssignmentEvents().map((event: any) => (
                <View key={event.id} style={styles.historyRow}>
                  <Text style={[
                    styles.historyEvent,
                    { color: event.eventType === "ASSIGNED" ? "#065f46" : "#9f1239" }
                  ]}>
                    {event.eventType === "ASSIGNED" ? "Assigned" : "Unassigned"}
                  </Text>
                  <Text style={styles.historyMeta}>{formatDateTime(event.createdAt)}</Text>
                </View>
              ))}
            </View>
          </View>

          {template.sections.map((section: any, sIndex: number) => {
            const sectionKey = section.id || String(sIndex);
            const isExpanded = !!expandedSections[sectionKey];

            return (
              <View key={sectionKey} style={styles.section}>
                <TouchableOpacity
                  style={styles.sectionHeader}
                  onPress={() => toggleSection(sectionKey)}
                  activeOpacity={0.75}
                >
                  <View style={styles.sectionTitleGroup}>
                    <Text style={styles.sectionTitle}>{section.name}</Text>
                    <Text style={styles.sectionMeta}>
                      {section.items?.length || 0} item{section.items?.length === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <Text style={styles.sectionChevron}>{isExpanded ? "-" : "+"}</Text>
                </TouchableOpacity>

                {isExpanded && (section.items || []).map((item: any) => {
                  const response = getResponse(item.id);

                  return (
                    <View key={item.id} style={styles.itemCard}>
                      <Text style={styles.itemLabel}>
                        {item.label}{item.required === false ? " (Optional)" : ""}{item.unit ? ` - ${item.unit}` : ""}
                      </Text>
                      {item.type === "range" && item.rangeMin != null && item.rangeMax != null && (
                        <Text style={styles.rangeHint}>
                          Allowed: {item.rangeMin} - {item.rangeMax}{item.unit ? ` ${item.unit}` : ""}
                        </Text>
                      )}

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Value</Text>
                        {item.type === "boolean" ? (
                          <View style={{ flexDirection: "row", gap: 10 }}>
                            {["OK", "Not OK"].map((option) => (
                              <TouchableOpacity
                                key={option}
                                onPress={() => updateValue(item.id, "value", option)}
                                style={[
                                  styles.input,
                                  {
                                    flex: 1,
                                    alignItems: "center",
                                    backgroundColor: response?.value === option ? Colors.primary : Colors.white,
                                    borderColor: response?.value === option ? Colors.primary : Colors.border
                                  }
                                ]}
                              >
                                <Text style={{ color: response?.value === option ? Colors.white : Colors.text, fontWeight: "700" }}>{option}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        ) : item.type === "mcq" && Array.isArray(item.choices) ? (
                          <View style={styles.choiceGrid}>
                            {item.choices.map((choice: any, index: number) => {
                              const color = choiceColors[choice.color] || choiceColors.gray;
                              const selected = response?.value === choice.label;

                              return (
                                <TouchableOpacity
                                  key={choice.id || `${item.id}-${index}`}
                                  onPress={() => updateValue(item.id, "value", choice.label)}
                                  style={[
                                    styles.choiceButton,
                                    {
                                      backgroundColor: selected ? color.text : color.bg,
                                      borderColor: selected ? color.text : color.border
                                    }
                                  ]}
                                >
                                  <Text style={[styles.choiceButtonText, { color: selected ? Colors.white : color.text }]}>
                                    {choice.label}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        ) : (
                          <TextInput
                            placeholder={item.placeholder || (item.type === "number" || item.type === "range" ? "Enter numeric value" : "e.g. 5 bar, OK, 120V")}
                            value={response?.value || ""}
                            onChangeText={(val) => updateValue(item.id, "value", val)}
                            style={styles.input}
                            placeholderTextColor={Colors.muted}
                            keyboardType={item.type === "number" || item.type === "range" ? "numeric" : "default"}
                          />
                        )}
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Remark (Optional)</Text>
                        <TextInput
                          placeholder="Add details..."
                          value={response?.remark || ""}
                          onChangeText={(val) => updateValue(item.id, "remark", val)}
                          style={[styles.input, styles.remarkInput]}
                          placeholderTextColor={Colors.muted}
                          multiline
                        />
                      </View>
                    </View>
                  );
                })}

                {isExpanded && (!section.items || section.items.length === 0) && (
                  <View style={styles.emptySection}>
                    <Text style={styles.emptySectionText}>No checklist items in this section.</Text>
                  </View>
                )}
              </View>
            );
          })}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.btnDisabled]}
            onPress={submitInspection}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitBtnText}>Submit Inspection</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={goBack}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: Spacing.md,
    color: Colors.textSecondary,
    fontSize: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  infoText: {
    fontSize: 18,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  backBtn: {
    padding: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  backBtnText: {
    color: Colors.white,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerBackBtn: {
    width: 60,
  },
  headerBackText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.md,
  },
  infoSection: {
    marginBottom: Spacing.lg,
  },
  templateName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text,
  },
  taskStatus: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  historyBox: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: 4,
  },
  historyEvent: {
    fontSize: 12,
    fontWeight: '800',
  },
  historyMeta: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  section: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitleGroup: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionMeta: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  sectionChevron: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.lightGray,
    color: Colors.primary,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
    textAlign: 'center',
    overflow: 'hidden',
  },
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadow.light,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  rangeHint: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.sm,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  input: {
    backgroundColor: Colors.lightGray,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    fontSize: 16,
    color: Colors.text,
  },
  remarkInput: {
    height: 60,
    textAlignVertical: 'top',
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  choiceButton: {
    minWidth: '47%',
    flexGrow: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  choiceButtonText: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptySection: {
    backgroundColor: Colors.lightGray,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptySectionText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  submitBtn: {
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.md,
    height: 56,
    justifyContent: 'center',
  },
  btnDisabled: {
    backgroundColor: Colors.muted,
  },
  submitBtnText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelBtn: {
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  cancelBtnText: {
    color: Colors.danger,
    fontSize: 16,
  },
});
