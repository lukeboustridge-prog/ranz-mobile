/**
 * User Management Screen
 * Admin screen for managing inspectors and reviewers
 */

import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { RoleBadge } from "../../src/components/badges";
import { getAllUsers } from "../../src/lib/sqlite";
import type { LocalUser } from "../../src/types/database";
import { UserRole, UserStatus } from "../../src/types/shared";

export default function UserManagementScreen() {
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "ALL">("ALL");

  const loadUsers = useCallback(async () => {
    try {
      const allUsers = await getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error("[UserManagement] Failed to load users:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadUsers();
    setIsRefreshing(false);
  };

  const handleUserAction = (user: LocalUser, action: "suspend" | "activate" | "changeRole") => {
    Alert.alert(
      action === "suspend"
        ? "Suspend User"
        : action === "activate"
        ? "Activate User"
        : "Change Role",
      `Are you sure you want to ${action} ${user.name}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            // In a real app, this would call an API
            console.log(`[UserManagement] ${action} user:`, user.id);
            Alert.alert("Success", `User ${action} action completed`);
          },
        },
      ]
    );
  };

  const filteredUsers = users.filter((user) => {
    // Role filter
    if (roleFilter !== "ALL" && user.role !== roleFilter) {
      return false;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesName = user.name?.toLowerCase().includes(query);
      const matchesEmail = user.email?.toLowerCase().includes(query);
      if (!matchesName && !matchesEmail) {
        return false;
      }
    }

    return true;
  });

  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case "ACTIVE":
        return "#059669";
      case "SUSPENDED":
        return "#dc2626";
      case "PENDING_APPROVAL":
        return "#d97706";
      default:
        return "#6b7280";
    }
  };

  const renderUserItem = ({ item }: { item: LocalUser }) => (
    <View style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.name}</Text>
          <RoleBadge role={item.role} size="sm" />
        </View>
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        />
      </View>

      <Text style={styles.userEmail}>{item.email}</Text>

      <View style={styles.userMeta}>
        {item.company && (
          <Text style={styles.metaText}>Company: {item.company}</Text>
        )}
        {item.lbpNumber && (
          <Text style={styles.metaText}>LBP: {item.lbpNumber}</Text>
        )}
        {item.yearsExperience && (
          <Text style={styles.metaText}>{item.yearsExperience} years exp.</Text>
        )}
      </View>

      <View style={styles.userActions}>
        {item.status === "ACTIVE" ? (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleUserAction(item, "suspend")}
          >
            <Text style={styles.suspendText}>Suspend</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleUserAction(item, "activate")}
          >
            <Text style={styles.activateText}>Activate</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleUserAction(item, "changeRole")}
        >
          <Text style={styles.changeRoleText}>Change Role</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#dc2626" />
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Role Filter Tabs */}
      <View style={styles.filterTabs}>
        {(["ALL" as const, UserRole.INSPECTOR, UserRole.REVIEWER, UserRole.ADMIN]).map((role) => (
          <TouchableOpacity
            key={role}
            style={[
              styles.filterTab,
              roleFilter === role && styles.filterTabActive,
            ]}
            onPress={() => setRoleFilter(role)}
          >
            <Text
              style={[
                styles.filterTabText,
                roleFilter === role && styles.filterTabTextActive,
              ]}
            >
              {role === "ALL" ? "All" : role.charAt(0) + role.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by name or email..."
          placeholderTextColor="#9ca3af"
        />
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""}
          {roleFilter !== "ALL" && ` (${roleFilter.toLowerCase()}s)`}
        </Text>
      </View>

      {/* User List */}
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderUserItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={["#dc2626"]}
            tintColor="#dc2626"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No Users Found</Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? "No users match your search"
                : "No users in the system yet"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: "#6b7280",
  },
  filterTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  filterTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: "#dc2626",
  },
  filterTabText: {
    fontSize: 14,
    color: "#6b7280",
  },
  filterTabTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
  searchContainer: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  searchInput: {
    backgroundColor: "#f3f4f6",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
  },
  statsBar: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  statsText: {
    fontSize: 12,
    color: "#6b7280",
  },
  listContent: {
    padding: 16,
  },
  userCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  userHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  userInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  userName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  userEmail: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
  },
  userMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    color: "#9ca3af",
  },
  userActions: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#f3f4f6",
    paddingTop: 12,
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  suspendText: {
    fontSize: 14,
    color: "#dc2626",
    fontWeight: "500",
  },
  activateText: {
    fontSize: 14,
    color: "#059669",
    fontWeight: "500",
  },
  changeRoleText: {
    fontSize: 14,
    color: "#2d5c8f",
    fontWeight: "500",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
  },
});
